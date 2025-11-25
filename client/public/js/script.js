// Simple menu toggle functionality
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
    
menuToggle.addEventListener('click', function() {

  navMenu.classList.toggle('active');
  menuToggle.classList.toggle('active');

});
    
// Close menu when clicking on a link
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', function() {

      navMenu.classList.remove('active');
      menuToggle.classList.remove('active');

   });
});