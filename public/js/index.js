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

        // 3. SCROLL TO TOP FUNCTION
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }