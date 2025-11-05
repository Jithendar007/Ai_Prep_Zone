// =========================================================
// SCRIPT.JS - FINAL MASTER VERSION
// =========================================================

function goNext() {
  window.location.href = "explore.html";
}

function goquiz() {
  window.location.href = "quiz.html";
}

function goqp() {
  window.location.href = "chat.html";
}

document.addEventListener("DOMContentLoaded", () => {
    
    const attemptBtn = document.getElementById("attemptBtn");
    if (attemptBtn) {
        const setupSection = document.getElementById("setupSection");
        const quizSection = document.getElementById("quizSection");
        const quizQuestion = document.getElementById("quizQuestion");
        const quizOptions = document.getElementById("quizOptions");
        const nextBtn = document.getElementById("nextBtn");
        const showBtn = document.getElementById("showBtn");
        const submitAnswerBtn = document.getElementById("submitAnswerBtn");
        const feedback = document.getElementById("feedback");
        const endScreen = document.getElementById("endScreen");
        const playAgainBtn = document.getElementById("playAgainBtn");
        const finalScoreEl = document.getElementById("finalScore");
        const reviewBtn = document.getElementById("reviewBtn");
        const reviewSection = document.getElementById("reviewSection");

        if(playAgainBtn) {
            playAgainBtn.onclick = () => { window.location.reload(); };
        }
        
        attemptBtn.addEventListener("click", async () => {
            const topic = document.getElementById("topic").value.trim();
            const count = parseInt(document.getElementById("count").value);
            const difficulty = document.getElementById("difficulty").value;

            if (!topic) {
                alert("Please enter a topic before starting the quiz.");
                return;
            }

            try {
                attemptBtn.disabled = true;
                attemptBtn.textContent = "Generating...";
                const response = await fetch("/generate-questions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ topic, count, difficulty }),
                });
                const data = await response.json();

                if (response.status !== 200 || !data.questions || data.questions.length === 0) {
                    const errorMessage = data.error || "No questions were generated.";
                    alert(errorMessage);
                    return; 
                }

                setupSection.style.display = "none";
                quizSection.style.display = "block";

                let currentIndex = 0;
                let score = 0;
                const questions = data.questions;
                const userAnswers = new Array(questions.length).fill(null);

                function showEndScreen() {
                    quizSection.style.display = "none";
                    endScreen.style.display = "block";
                    finalScoreEl.textContent = `You scored ${score} out of ${questions.length}!`;
                }
                
                // --- REPLACE your old displayReview function with this new one ---

function displayReview() {
    endScreen.style.display = "none";
    reviewSection.style.display = "block";

    // We've changed the button to a <button> with a new ID
    let reviewHTML = `
        <div class="review-header">
            <h2>Review Your Answers</h2>
            <button id="backToScoreBtn">← Back to Score</button>
        </div>
    `;

    questions.forEach((q, index) => {
        reviewHTML += `<div class="review-question"><p>Q${index + 1}: ${q.question}</p><ul class="review-options">`;
        q.options.forEach(opt => {
            let classes = 'review-option';
            const isUserAnswer = userAnswers[index] === opt;
            const isCorrectAnswer = q.answer.trim() === opt.trim();
            if (isCorrectAnswer) classes += ' correct-answer';
            if (isUserAnswer) {
                classes += ' user-answer';
                if (!isCorrectAnswer) classes += ' wrong-answer';
            }
            reviewHTML += `<li class="${classes}">${opt}</li>`;
        });
        reviewHTML += `</ul></div>`;
    });
    reviewSection.innerHTML = reviewHTML;

    // After creating the button, we find it and add its click logic
    const backToScoreBtn = document.getElementById("backToScoreBtn");
    if(backToScoreBtn){
        backToScoreBtn.onclick = () => {
            reviewSection.style.display = "none"; // Hide the review
            endScreen.style.display = "block"; // Show the score screen again
        };
    }
}
                
                if (reviewBtn) {
                    reviewBtn.onclick = displayReview;
                }

                function showQuestion(index) {
                    const q = questions[index];
                    quizQuestion.textContent = `Q${index + 1}: ${q.question}`;
                    quizOptions.innerHTML = q.options
                        .map(opt => `<li><button class="optionBtn">${opt}</button></li>`)
                        .join("");
                    feedback.textContent = "";

                    let selectedAnswer = null;
                    const optionButtons = document.querySelectorAll(".optionBtn");
                    
                    submitAnswerBtn.style.display = 'block';
                    submitAnswerBtn.disabled = true;

                    if (index === questions.length - 1) {
                        nextBtn.style.display = 'none';
                    } else {
                        nextBtn.style.display = 'block';
                    }

                    optionButtons.forEach(btn => {
                        btn.onclick = () => {
                            optionButtons.forEach(b => b.classList.remove("selected"));
                            btn.classList.add("selected");
                            selectedAnswer = btn.textContent;
                            submitAnswerBtn.disabled = false;
                        };
                    });

                    submitAnswerBtn.onclick = () => {
                        if (!selectedAnswer) {
                            alert("Please select an answer before submitting.");
                            return;
                        }

                        optionButtons.forEach(b => b.classList.add("disabled"));
                        submitAnswerBtn.disabled = true;

                        userAnswers[currentIndex] = selectedAnswer;
                        const selectedButton = Array.from(optionButtons).find(b => b.classList.contains("selected"));

                        if (selectedAnswer.trim() === q.answer.trim()) {
                            selectedButton.classList.add("correct");
                            feedback.textContent = "✅ Correct!";
                            feedback.style.color = "green";
                            score++;
                        } else {
                            selectedButton.classList.add("wrong");
                            feedback.textContent = `❌ Wrong!`;
                            feedback.style.color = "red";
                            const correctButton = Array.from(optionButtons).find(b => b.textContent.trim() === q.answer.trim());
                            if(correctButton) correctButton.classList.add("correct");
                        }
                        
                        if (currentIndex === questions.length - 1) {
                            setTimeout(showEndScreen, 2000); 
                        }
                    };
                }

                showQuestion(currentIndex);

                nextBtn.onclick = () => {
                    if (currentIndex < questions.length - 1) {
                        currentIndex++;
                        showQuestion(currentIndex);
                    }
                };

                showBtn.onclick = () => {
                    const correctAnswer = questions[currentIndex].answer.trim();
                    const optionButtons = document.querySelectorAll(".optionBtn");
                    optionButtons.forEach(btn => {
                        btn.classList.add("disabled");
                        if (btn.textContent.trim() === correctAnswer) {
                            btn.classList.add("correct");
                        }
                    });
                    submitAnswerBtn.disabled = true;
                    feedback.textContent = `Answer: ${correctAnswer}`;
                    feedback.style.color = "blue";
                };

            } catch (err) {
                console.error("Error fetching questions:", err);
                alert("Something went wrong. Check the browser console.");
            } finally {
                attemptBtn.disabled = false;
                attemptBtn.textContent = "Attempt Quiz";
            }
        });
    }
});