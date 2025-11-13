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
const GEMINI_API_KEY = 'AIzaSyCDdJs3VrQFam5x7Kf7JyufGxHiHHkltIQ';

app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.get('/api/test', (req, res) => res.json({ message: 'Backend is working' }));
app.get('/create', (req, res) => res.sendFile(path.join(__dirname, '../client/create.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client/index.html')));


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
    console.error('❌ Error generating resume:', error);
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
You are a professional web designer and layout optimizer.

Generate a COMPLETE, single-file HTML resume closely matching the design of the following layout:

- Clean, modern theme using colors:
  --primary: ${data.fontColor},#205b6a
  --secondary:${data.color}
  --text: #333
  --background: #f8f8f8
- Fonts: "Poppins" for headings, "Inter" for body with combination of ${data.font}
- Rounded edges, subtle shadows, and consistent spacing
- Responsive for web preview
- strictly optimized for A4/Letter export using converting INTO PDF using nodejs puppeteer library.

The HTML must:
1. Be completely self-contained (no external links or font CDNs).
2. Use inline or internal CSS only.
3. Use exact printable width/height proportions: 210mm × 297mm.
4. Include a "@media print" section that:
   - Removes all shadows/backgrounds.
   - Keeps text readable with black color.
   - Prevents page breaks inside sections.
   - Uses 0.5in margins.
5. Use millimeters or centimeters for sizing instead of px.

DYNAMIC HEIGHT ADJUSTMENT LOGIC:
If total content height exceeds A4/Letter page ratio:
- Automatically compress vertical space using smaller margins/paddings.
- Slightly reduce font-size using "clamp()" and "calc()".
- Compact multi-item lists (e.g., projects, experiences, skills) into 2-column grids.
- Merge long sections with subtle dividers instead of large spacing.
- Ensure the final rendered page never exceeds one A4 page height (when viewed or printed).

Left column:
- Profile photo placeholder
- Contact information
- Skills list with small rounded boxes
- Education timeline
- Certifications

Right column:
- Name and title header
- Objective / Summary
- Experience (role, org, details)
- Projects (title, short description, link)
- Achievements / Technical Proficiencies (if needed)

DESIGN BEHAVIOR:
- Match proportions, typography, and spacing of the existing index.html file.
- Maintain the same section hierarchy and visual order.
- Keep hover effects minimal.
- Maintain box shadows only for screen mode (remove in print mode).
- Preserve color identity and professional aesthetic.
- nothing should overflow or underflow , it should be a good looking pdf output
- it should not have unnecessary space,padding.
- **ehnace every section with details description**.
TEMPLATE:
follow this template:
${template}
OUTPUT:
Generate the full HTML with embedded CSS that:
- Auto-adjusts vertically for longer content.
- Fits perfectly on one A4 page when converted with html2pdf.js.
- Returns ONLY valid HTML code (no markdown, explanations, or comments).
`;

  const contexts = `
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
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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
  console.log(`✅ Server running: http://localhost:${PORT}`);
});
