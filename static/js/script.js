





// Function to animate the cloud image when the section is scrolled into view
function animateImageOnScroll() {
    const cloudImage = document.querySelector('.cloud-image');
    const cloudServiceSection = document.querySelector('.cloud-service');

    // Get the position of the section relative to the viewport
    const sectionPosition = cloudServiceSection.getBoundingClientRect().top;

    // Get the height of the viewport
    const viewportHeight = window.innerHeight;

    // Check if the section is within the viewport
    if (sectionPosition < viewportHeight && sectionPosition > 0) {
        cloudImage.classList.add('animate-left');
    } else {
        cloudImage.classList.remove('animate-left');
    }
}

// Listen to the scroll event
window.addEventListener('scroll', animateImageOnScroll);

document.addEventListener('DOMContentLoaded', function () {
    // Target the elements
    const lineImage = document.querySelector('.line-image');
    const craftingImage = document.querySelector('.crafting-image');
    const workTogetherSection = document.querySelector('.work-together-section');

    // Create Intersection Observer to watch the section
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add animation classes when in view
                lineImage.classList.add('animate-line-image');
                craftingImage.classList.add('animate-crafting-image');
            } else {
                // Remove animation classes when out of view
                lineImage.classList.remove('animate-line-image');
                craftingImage.classList.remove('animate-crafting-image');
            }
        });
    }, {
        threshold: 0.5 // Trigger when 50% of the section is visible
    });

    // Observe the section
    observer.observe(workTogetherSection);
});



// FAQ toggle functionality
const faqQuestions = document.querySelectorAll('.faq-question');

faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        answer.style.display = answer.style.display === 'block' ? 'none' : 'block';
    });
});

// Image movement on scroll
const faqImage = document.querySelector('.faq-img img');
window.addEventListener('scroll', () => {
    const scrollPosition = window.scrollY;
    faqImage.style.transform = `translateX(${scrollPosition * -0.1}px)`;
});


// Image movement on scroll with a subtle effect
const topImg = document.querySelector('.top-img');
window.addEventListener('scroll', () => {
    const scrollPosition = window.scrollY;
    topImg.style.transform = `translateY(${scrollPosition * 0.03}px)`; // Subtle movement
});






