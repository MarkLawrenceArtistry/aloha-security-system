 // 1. INITIALIZE ANIMATIONS
        AOS.init({
            offset: 100, // offset (in px) from the original trigger point
            delay: 0, // values from 0 to 3000, with step 50ms
            duration: 800, // values from 0 to 3000, with step 50ms
            easing: 'ease-out-cubic', // default easing for AOS animations
            once: true, // whether animation should happen only once - while scrolling down
            mirror: false, // whether elements should animate out while scrolling past them
        });

        // 2. SMART NAVBAR & BACK TO TOP LOGIC
        let lastScrollTop = 0;
        const navbar = document.querySelector('.navbar');
        const backToTopBtn = document.getElementById('backToTop');

        window.addEventListener('scroll', function() {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            // A. Smart Navbar Logic
            if (scrollTop > lastScrollTop && scrollTop > 200) {
                // Scroll Down -> Hide Navbar
                navbar.classList.add('navbar-hidden');
            } else {
                // Scroll Up -> Show Navbar
                navbar.classList.remove('navbar-hidden');
            }

            // B. Existing Scrolled Glass Effect
            if (scrollTop > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            // C. Back To Top Visibility
            if (scrollTop > 500) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }

            lastScrollTop = scrollTop;
        });

         const counters = document.querySelectorAll('.counter');
        let hasCounted = false;

        const animateCounters = () => {
            counters.forEach(counter => {
                const target = +counter.getAttribute('data-target');
                const speed = 200; // The lower the slower
                
                const updateCount = () => {
                    const count = +counter.innerText;
                    const inc = target / speed;

                    if (count < target) {
                        counter.innerText = Math.ceil(count + inc);
                        setTimeout(updateCount, 20); // Speed of count
                    } else {
                        counter.innerText = target;
                    }
                };
                updateCount();
            });
        };

        // Trigger animation when stats section is visible
        window.addEventListener('scroll', () => {
            const statsSection = document.querySelector('.stats-section');
            if(!statsSection) return;
            
            const sectionPos = statsSection.getBoundingClientRect().top;
            const screenPos = window.innerHeight / 1.3;

            if(sectionPos < screenPos && !hasCounted) {
                animateCounters();
                hasCounted = true; // Ensures it only runs once
            }
        });

        // 3. SCROLL TO TOP FUNCTION
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }