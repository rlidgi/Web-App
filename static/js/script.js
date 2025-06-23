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

    document.addEventListener('DOMContentLoaded', function () {
        const menuButton = document.getElementById('menuButton');
        const mobileMenu = document.getElementById('mobileMenu');
        const closeMenuButton = document.getElementById('closeMenu');

        if (menuButton && mobileMenu) {
            menuButton.addEventListener('click', () => {
                console.log('Menu button clicked');
                console.log('Before toggle:', mobileMenu.classList);
                if (mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.remove('hidden');
                    mobileMenu.style.border = '2px solid green'; // Visual indicator
                    menuButton.setAttribute('aria-expanded', 'true');
                    console.log('Mobile menu opened');
                } else {
                    mobileMenu.classList.add('hidden');
                    mobileMenu.style.border = '2px solid red'; // Visual indicator
                    menuButton.setAttribute('aria-expanded', 'false');
                    console.log('Mobile menu closed');
                }
                console.log('After toggle:', mobileMenu.classList);
            });
        }

        if (closeMenuButton && mobileMenu) {
            closeMenuButton.addEventListener('click', () => {
                console.log('Close button clicked');
                console.log('Before toggle:', mobileMenu.classList);
                mobileMenu.classList.add('hidden');
                mobileMenu.style.border = '2px solid red'; // Visual indicator
                menuButton.setAttribute('aria-expanded', 'false');
                console.log('Mobile menu closed via close button');
                console.log('After toggle:', mobileMenu.classList);
            });
        }

        // Close the menu when clicking outside of it
        document.addEventListener('click', (event) => {
            if (mobileMenu && !mobileMenu.contains(event.target) && !menuButton.contains(event.target)) {
                console.log('Clicked outside the menu');
                console.log('Before toggle:', mobileMenu.classList);
                mobileMenu.classList.add('hidden');
                mobileMenu.style.border = '2px solid red'; // Visual indicator
                menuButton.setAttribute('aria-expanded', 'false');
                console.log('Mobile menu closed via outside click');
                console.log('After toggle:', mobileMenu.classList);
            }
        });
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
});

document.addEventListener('DOMContentLoaded', function () {
    const menuButton = document.getElementById('menuButton');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMenuButton = document.getElementById('closeMenu');

    if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', () => {
            mobileMenu.classList.add('active');
            menuButton.setAttribute('aria-expanded', 'true');
        });
    }

    if (closeMenuButton && mobileMenu) {
        closeMenuButton.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            menuButton.setAttribute('aria-expanded', 'false');
        });
    }

    // Optional: Close the menu when clicking outside of it
    document.addEventListener('click', (event) => {
        if (
            mobileMenu.classList.contains('active') &&
            !mobileMenu.contains(event.target) &&
            !menuButton.contains(event.target)
        ) {
            mobileMenu.classList.remove('active');
            menuButton.setAttribute('aria-expanded', 'false');
        }
    });
});





