const form = document.getElementById('resumeForm');

window.addEventListener('DOMContentLoaded', () => {
  const savedData = JSON.parse(localStorage.getItem('resumeData'));
  if (savedData) {
    for (const key in savedData) {
      const field = document.getElementById(key);
      if (field) field.value = savedData[key];
    }
  }
});

form.addEventListener('input', () => {
  const formData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    objective: document.getElementById('objective').value,
    education: document.getElementById('education').value,
    skills: document.getElementById('skills').value,
    experience: document.getElementById('experience').value,
    projects: document.getElementById('projects').value,
    certifications: document.getElementById('certifications').value,
    template: document.getElementById('template').value,
    font: document.getElementById('font').value,
    fontColor: document.getElementById('fontColor').value,
    color: document.getElementById('color').value
  };
  localStorage.setItem('resumeData', JSON.stringify(formData));
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitButton = document.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;

  try {
    submitButton.textContent = 'Generating Resume...';
    submitButton.disabled = true;

    const formData = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value,
      objective: document.getElementById('objective').value,
      education: document.getElementById('education').value,
      skills: document.getElementById('skills').value,
      experience: document.getElementById('experience').value,
      projects: document.getElementById('projects').value,
      certifications: document.getElementById('certifications').value,
      template: document.getElementById('template').value,
      font: document.getElementById('font').value,
      fontColor: document.getElementById('fontColor').value,
      color: document.getElementById('color').value
    };

    const res = await fetch('/api/generate-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      mode: 'cors'
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Server returned ${res.status}: ${errorText}`);
    }

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
    console.error('Full error details:', err);
    alert("Error generating resume: " + err.message);
  } finally {
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }
});

// Backend connectivity test
fetch('http://localhost:3001/api/test')
  .then(response => response.json())
  .then(data => console.log('Backend test data:', data))
  .catch(error => console.error('Backend test error:', error));