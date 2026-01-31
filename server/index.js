require("dotenv").config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const fs_e = require('fs')
const { GoogleGenAI } = require("@google/genai");
const puppeteer = require('puppeteer');
const app = express();
const PORT = 3001;

// Gemini API key
const GEMINI_API_KEY = process.env.API_KEY;

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname,"../client/public")));

app.get('/api/test', (req, res) => res.json({ message: 'Backend is working' }));
app.get('/create', (req, res) => res.sendFile("pages/create.html",{root:__dirname+"/../client"}));
app.get('/', (req, res) => res.sendFile("pages/index.html",{root:__dirname+"/../client"}));
app.get('/about',(req,res)=> res.sendFile("pages/about.html",{root:__dirname+"/../client"}));

app.post('/api/generate-resume', async (req, res) => {
  let filePath = null;

  try {
    const formData = req.body;

    // Generate the PDF file
    const fileName = `${formData.name || 'resume'}.pdf`;
    filePath = path.join(__dirname, 'upload', fileName);

    const pdf = await generatePDFFromAI(formData);
    console.log("pdf generated..")

    // Check if the file exists
    if (!pdf) {
      console.log("pdf not found")
      return res.status(404).send('PDF not found');
    }

    const pdfStream = fs_e.createReadStream(filePath);
    const stat = fs_e.statSync(filePath);

    // Set headers to trigger browser download
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');

    // Handle successful stream completion
    pdfStream.on('end', () => {
      console.log('File stream completed, deleting file...');
      deleteFile(filePath);
    });

    // Handle client disconnect/abort
    res.on('close', () => {
      if (!res.finished) {
        console.log('Client disconnected early, deleting file...');
        deleteFile(filePath);
      }
    });

    // Pipe the stream to response
    pdfStream.pipe(res);

    // Handle potential errors during streaming
    pdfStream.on('error', (err) => {
      console.error('Error streaming PDF:', err);
      deleteFile(filePath); // Delete file on stream error
      res.status(500).send('Error streaming PDF');
    });

  } catch (error) {
    console.error('Error generating resume:', error);
    if (filePath) {
      deleteFile(filePath); // Delete file on any other error
    }
    res.status(500).json({ error: 'Failed to generate resume', details: error.message });
  }
});

// --------------delete files--------------
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    console.log('File deleted successfully:', filePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('File already deleted:', filePath);
    } else {
      console.error('Error deleting file:', err);
    }
  }
}

//---------------read file----------------
async function readFile() {
  try {
    const data = await fs.readFile('assets/templates/template.html', { encoding: 'utf8' });
    return data
  } catch (err) {
    console.error('Error reading file:', err);
  }
}

// ---------------- AI Call ----------------
async function getAIResume(data) {

const template =await readFile()

const systemInstruction = `
You are a professional resume designer specializing in concise, space-optimized 2-page A4 resumes.

Generate a COMPLETE single-file HTML resume using the provided template.
The resume MUST fit strictly within 2 A4 pages.

-----------------------------------
COLOR RULES (MANDATORY)
-----------------------------------
1. ACCENT COLOR: ${data.color}
   Use ONLY for these section titles:
   - Career Objective
   - Education
   - Technical Skills
   - Experience
   - Projects
   - Certifications
   - Hobbies
   - Languages

2. FONT COLOR: ${data.fontColor}
   Use for ALL other text:
   - Name (h1)
   - Contact information
   - Section content and bullet points
   - Dates, CGPA, institution names
   - Section borders/underlines
   - All other text not explicitly listed in "accent color" section

-----------------------------------
CONTACT FORMAT (FIXED)
-----------------------------------
Display contact information horizontally using ONLY:
📧 ${data.email}
📱 ${data.phone}
📍 ${data.address}

No other emojis allowed.

-----------------------------------
PAGE LAYOUT STRUCTURE
-----------------------------------
PAGE 1:
- Header (name + contact)
- Career Objective (concise refinement)
- Education
- Two-column block:
  • Left: Technical Skills
  • Right: Languages + Hobbies

PAGE 2:
- Experience (top)
- Projects (middle)
- Certifications (bottom, compact line-by-line format)

-----------------------------------
CONTENT RULES
-----------------------------------
- Light refinement only (grammar, clarity, concise wording)
- MUST include all user-provided text
- Technical Skills: compact list (no percentages)
- Experience: max 2-3 concise bullet points per role
- Projects: 1-2 line descriptions
- Certifications: compact single-line format

-----------------------------------
SPACE & RENDERING REQUIREMENTS
-----------------------------------
- Use grid/two-column layouts where needed to save space
- Minimize vertical spacing and remove redundancy
- Ensure ALL content fits exactly within 2 A4 pages
- Entire resume horizontally centered: margin: 0 auto;
- Prevent cutoffs with:
  word-wrap: break-word;
  overflow-wrap: break-word;
  box-sizing: border-box;


-----------------------------------
CRITICAL RULES - MUST FOLLOW:
-----------------------------------
- All sections must present in resume.
- MUST include all user-provided text with light refinement only (grammar, clarity, concise wording).
- Ensure all section content stays together on the same page without splitting across multiple pages - use page-break-inside: avoid and proper spacing control.
- Expand and enhance all content/sections with detailed, professional descriptions but must not go above 2 pages resume:
   - CAREER OBJECTIVE: Transform into 2-3 compelling sentences showing passion, skills, and career goals
   - EDUCATION: Add relevant coursework, academic achievements, and key learnings
   - EXPERIENCE: Expand with specific responsibilities, technologies used, and quantifiable impacts
   - HOBBIES: Elaborate with meaningful context showing personality and transferable skills
   - Use professional language and industry-specific terminology
   - Make content engaging and impactful for recruiters
   - MAXIMUM CONTENT WIDTH: 700px or 180mm for A4 paper
   - Use word-wrap: break-word and overflow-wrap: break-word on ALL text elements
   - Implement text-overflow: ellipsis for very long content
   - Use box-sizing: border-box globally to prevent padding/margin overflow
   - Table columns MUST be responsive and wrap properly
   - Ensure no horizontal scrolling or content cutoff
   - Test that all text fits within A4 page boundaries (210mm width)


-----------------------------------
TEMPLATE
-----------------------------------
${template}
`;


const contexts = `
Input Data:
Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone}
Address: ${data.address}
Objective: ${data.objective}
Education: ${data.education}
Skills: ${data.skills}
Experience: ${data.experience}
Projects: ${data.projects}
Certifications: ${data.certifications}
Languages: ${data.languages}
Hobbies: ${data.hobbies}

LAYOUT RULES:
- Must fit exactly within 2 A4 pages.
- Use ONLY 📧 📱 📍 for contact information in a compact horizontal line.
- Place Languages and Hobbies beside Technical Skills in a two-column layout (Page 1).
- Place Certifications compactly on Page 2 (bottom).
- Projects must be 1-2 line descriptions.
- Use spacing, grids, and compact formatting to avoid empty gaps and page overflow.
- Include all user text with light refinement for grammar and conciseness.
`;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contexts,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    let aiText = response.text;
    const sub_str1 = "```html";
    const sub_str2 = "```";
    aiText = aiText.replace(sub_str1,"");
    aiText = aiText.replace(sub_str2,"");
    return aiText;
    

  } catch (err) {
    console.error('AI API error:', err);
    alert("something wrong while generating resume,\nplease try agian")
    return false
  }
}



// ---------------- PDF Generation ----------------
async function generatePDFFromAI(data) {
  try{
    const browser = await  puppeteer.launch()
    const page = await browser.newPage()

    html_from_ai = await getAIResume(data)
    if(html_from_ai){
      await page.setContent(html_from_ai);
      await page.pdf({ path:path.join(__dirname,'upload' ,`${data.name || 'resume'}.pdf`), format: 'A4' });
      await browser.close();
      return true;
    }else{
      console.log("something goes wrong with ai response")
      return false;
    }
  }
  catch (error) {
    console.error("pdf generation error: ",error)
    reject(error)
    return false;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running: http://localhost:${PORT}`);
});