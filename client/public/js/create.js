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


const form = document.getElementById('resumeForm');

//Load saved data from localStorage on page load - Provides auto-restore if user refreshes or returns later.
window.addEventListener('DOMContentLoaded', () => {
  const savedData = JSON.parse(localStorage.getItem('resumeData'));
  if (savedData) {
    for (const key in savedData) {
      const field = document.getElementById(key);
      if (field) field.value = savedData[key];
    }
  }
});

function collectFormData() {
  const fields = ['name','email','phone','address','objective','education','skills','experience','projects','certifications','languages','hobbies','fontColor','color'];
  const data = {};
  fields.forEach(id => data[id] = document.getElementById(id).value);
  return data;
}

//Save form data to localStorage on every input - Every time the user types, the form values are saved to localStorage.
form.addEventListener('input', () => {
  const formData = collectFormData();
  localStorage.setItem('resumeData', JSON.stringify(formData));
});

// Refresh button clears form + localStorage
document.getElementById('refreshBtn').addEventListener('click', () => {
  if (confirm("Are you sure you want to refresh the form? All entered data will be cleared.")) {
    localStorage.removeItem('resumeData');
    form.reset();
  }
});

//When the user clicks the submit button, run this code
form.addEventListener('submit', async (e) => {
  e.preventDefault();    //Stop the page from refreshing
  const submitButton = document.querySelector('button[type="submit"]');  //This finds submit button in the HTML
  const originalText = submitButton.textContent;

  try {
    submitButton.textContent = 'Generating Resume...';  //Change the button to "Generating Resume..."
    submitButton.disabled = true;   //Disable the button

    const formData = collectFormData(); //Collect all form input values

    //This sends form data to the backend
    const res = await fetch('/api/generate-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      mode: 'cors'
    });

    if (!res.ok) throw new Error('Failed to generate resume');

    //This is the download mechanism
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resume-${formData.name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    alert('Resume generated successfully! Check your downloads.');

  } catch (err) {
    console.error(err);
    alert("Error generating resume: " + err.message);
  } finally {
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
});

// Backend connectivity test
// fetch('http://localhost:3001/api/test')
//   .then(response => response.json())
//   .then(data => console.log('Backend test data:', data))
//   .catch(error => console.error('Backend test error:', error));