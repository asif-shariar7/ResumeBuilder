const express = require('express');
const cors = require('cors');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const path = require('path');

const app = express();
const PORT = 3001;

// Gemini API key
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.get('/api/test', (req, res) => res.json({ message: 'Backend is working' }));
app.get('/create', (req, res) => res.sendFile(path.join(__dirname, '../client/create.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client/index.html')));

// ---------------- POST route ----------------
app.post('/api/generate-resume', async (req, res) => {
  try {
    const formData = req.body;

    // Call AI to rewrite key sections
    const aiResume = await getAIResume(formData);

    // Generate PDF
    const pdfBuffer = await generatePDFFromAI(aiResume, formData.fontColor, formData.color);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume-${formData.name}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating resume:', error);
    res.status(500).json({ error: 'Failed to generate resume', details: error.message });
  }
});

// ---------------- AI Call ----------------
async function getAIResume(data) {
  const prompt = `
You are a professional resume writer. 
Take the user's raw input and rewrite it into a polished, interview-ready resume. 
Return strictly as JSON. All text must be professionally formatted, action-oriented, and modern. Use bullets for multi-item sections.

JSON format:
{
  "contact": {
    "name": "",
    "email": "",
    "phone": "",
    "address": "",
    "linkedin": "",
    "portfolio": ""
  },
  "summary": "",
  "education": [],
  "skills": [],
  "experience": [],
  "projects": [],
  "certifications": []
}

Input Data:
Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone}
Address: ${data.address || 'N/A'}
Objective: ${data.objective || 'Dedicated professional with strong technical skills.'}
Education: ${data.education}
Skills: ${data.skills}
Experience: ${data.experience}
Projects: ${data.projects}
Certifications: ${data.certifications}
`;

  try {
    const response = await axios.post(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const aiText = response.data.candidates[0].content.parts[0].text;

    // Try parsing JSON from AI output
    try {
      const jsonStart = aiText.indexOf('{');
      const jsonEnd = aiText.lastIndexOf('}') + 1;
      const jsonString = aiText.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonString);

      // Ensure contact info is correct
      parsed.contact.name = data.name || parsed.contact.name;
      parsed.contact.email = data.email || parsed.contact.email;
      parsed.contact.phone = data.phone || parsed.contact.phone;
      parsed.contact.address = data.address || parsed.contact.address;
      parsed.contact.linkedin = `linkedin.com/in/${data.name?.toLowerCase().replace(/\s+/g, '-')}`;
      parsed.contact.portfolio = `${data.name?.toLowerCase().replace(/\s+/g,'')}.dev`;

      return parsed;
    } catch (err) {
      console.error('Error parsing AI JSON, fallback to raw input.', err);
      return mapFormDataToJSON(data);
    }

  } catch (err) {
    console.error('Gemini API call failed:', err.message);
    return mapFormDataToJSON(data); // fallback
  }
}

// ---------------- Fallback ----------------
function mapFormDataToJSON(data) {
  const splitToArray = str => str ? str.split(/[\n,;•-]+/).map(s => s.trim()).filter(Boolean) : [];

  return {
    contact: {
      name: data.name || 'N/A',
      email: data.email || 'N/A',
      phone: data.phone || 'N/A',
      address: data.address || 'N/A',
      linkedin: `linkedin.com/in/${data.name?.toLowerCase().replace(/\s+/g,'-') || 'N/A'}`,
      portfolio: `${data.name?.toLowerCase().replace(/\s+/g,'') || 'portfolio'}.dev`
    },
    summary: data.objective || 'Dedicated professional with strong technical skills.',
    education: splitToArray(data.education),
    skills: splitToArray(data.skills),
    experience: splitToArray(data.experience),
    projects: splitToArray(data.projects),
    certifications: splitToArray(data.certifications)
  };
}

// ---------------- PDF Generation ----------------
async function generatePDFFromAI(resume, fontColor = '#000000', accentColor = '#007bff') {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(22)
         .text(resume.contact.name.toUpperCase(), { align: 'center' });
      doc.fillColor(fontColor).font('Helvetica').fontSize(12)
         .text('Professional Resume', { align: 'center' });
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(accentColor).lineWidth(1).stroke();
      doc.moveDown(0.5);

      // Contact
      const c = resume.contact;
      doc.fillColor(fontColor).font('Helvetica').fontSize(10)
         .text(`Email: ${c.email} | Phone: ${c.phone} | Address: ${c.address}`, { align: 'center' });
      doc.text(`LinkedIn: ${c.linkedin} | Portfolio: ${c.portfolio}`, { align: 'center' });
      doc.moveDown(1);

      // Helper to add section
      const addSection = (title, content, isArray=false) => {
        if (!content || (Array.isArray(content) && content.length === 0)) return;
        doc.fillColor(accentColor).font('Helvetica-Bold').fontSize(14).text(title.toUpperCase());
        doc.moveDown(0.2);
        doc.fillColor(fontColor).font('Helvetica').fontSize(11);
        if (isArray) content.forEach(item => doc.text(`• ${item}`, { lineGap: 2 }));
        else doc.text(content, { lineGap: 2, align: 'justify' });
        doc.moveDown(0.5);
      };

      addSection('Professional Summary', resume.summary);
      addSection('Education', resume.education, true);
      addSection('Technical Skills', resume.skills, true);
      addSection('Professional Experience', resume.experience, true);
      addSection('Projects', resume.projects, true);
      addSection('Certifications', resume.certifications, true);
      addSection('References', ['Available upon request'], true);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
