const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

class ResultPdfService {
  async generateResultCard(result, hostUrl) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const primaryColor = '#0B5634';
        const darkText = '#1E293B';
        const lightText = '#64748B';
        const borderColor = '#CBD5E1';

        // QR Code for Result Verification
        const verifyUrl = `${hostUrl}/results/verify?token=${result.resultQrToken}`;
        const qrCodeBuffer = await QRCode.toBuffer(verifyUrl, {
          margin: 1,
          width: 200,
          color: { dark: '#000000', light: '#FFFFFF' }
        });

        const logoPath = path.join(__dirname, '../public/logo.png');
        const hasLogo = fs.existsSync(logoPath);

        // --- HEADER ---
        doc.rect(20, 10, 555, 98).fill('#F4FAF7');
        doc.rect(20, 10, 5, 98).fill(primaryColor);
        if (hasLogo) {
          doc.image(logoPath, 32, 18, { width: 62, height: 62 });
        }
        const orgX = 105;
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(20).text('HUNARMAND PUNJAB', orgX, 24, { characterSpacing: 0.5 });
        doc.rect(orgX, 48, 250, 2).fill(primaryColor);
        doc.fillColor('#4A6741').font('Helvetica').fontSize(9).text('Building Skills for a Brighter Future', orgX, 54);
        doc.fillColor(lightText).font('Helvetica').fontSize(7.5).text('Skill Development Initiative | Punjab, Pakistan', orgX, 68);

        // QR code section top right
        doc.moveTo(468, 14).lineTo(468, 104).strokeColor('#D1E8DA').lineWidth(1).stroke();
        doc.roundedRect(474, 12, 94, 94, 6).fill('#FFFFFF');
        doc.roundedRect(474, 12, 94, 94, 6).strokeColor('#D1E8DA').lineWidth(1).stroke();
        doc.image(qrCodeBuffer, 478, 14, { width: 72, height: 72 });
        doc.roundedRect(478, 90, 72, 13, 3).fill(primaryColor);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6).text('Scan to Verify', 478, 94, { width: 72, align: 'center' });
        doc.moveTo(20, 111).lineTo(575, 111).strokeColor('#D1E8DA').lineWidth(0.75).stroke();

        // --- BADGE ---
        doc.moveTo(20, 130).lineTo(195, 130).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(195, 130, 3).fill(primaryColor);
        doc.moveTo(400, 130).lineTo(575, 130).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(400, 130, 3).fill(primaryColor);
        doc.roundedRect(200, 119, 195, 23, 11).fill(primaryColor);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10.5).text('OFFICIAL RESULT CARD', 200, 126, { width: 195, align: 'center' });

        // --- STUDENT DETAILS ---
        const detailsY = 160;
        const col1 = 20, col2 = 290;

        const drawInfo = (lbl, val, x, y) => {
          doc.roundedRect(x, y, 260, 35, 6).strokeColor(borderColor).lineWidth(0.5).stroke();
          doc.fillColor(lightText).font('Helvetica').fontSize(7.5).text(lbl, x + 15, y + 6);
          doc.fillColor(darkText).font('Helvetica-Bold').fontSize(9).text(val || 'N/A', x + 15, y + 18, { width: 230 });
        };

        drawInfo('Candidate Name', result.studentName, col1, detailsY);
        drawInfo('Roll Number', result.rollNumber, col2, detailsY);
        drawInfo('CNIC', result.CNIC, col1, detailsY + 45);
        drawInfo('Course', result.course, col2, detailsY + 45);
        drawInfo('District', result.district, col1, detailsY + 90);
        drawInfo('Institute', result.institute || 'N/A', col2, detailsY + 90);

        // --- ACADEMIC PERFORMANCE (MARKS) ---
        const marksY = 300;
        doc.rect(20, marksY, 555, 25).fill('#F8FAFC').strokeColor(borderColor).lineWidth(1).stroke();
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10).text('ACADEMIC PERFORMANCE', 20, marksY + 8, { width: 555, align: 'center' });

        const tableY = marksY + 25;
        doc.rect(20, tableY, 555, 60).strokeColor(borderColor).lineWidth(1).stroke();
        
        // Table Headers
        doc.moveTo(20, tableY + 20).lineTo(575, tableY + 20).strokeColor(borderColor).stroke();
        const drawCell = (txt, x, w, y, bold = false) => {
          doc.fillColor(darkText).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).text(txt, x, y, { width: w, align: 'center' });
        };

        // Vertical lines
        const c1 = 150, c2 = 280, c3 = 410;
        doc.moveTo(c1, tableY).lineTo(c1, tableY + 60).stroke();
        doc.moveTo(c2, tableY).lineTo(c2, tableY + 60).stroke();
        doc.moveTo(c3, tableY).lineTo(c3, tableY + 60).stroke();

        drawCell('Theory Marks', 20, 130, tableY + 6, true);
        drawCell('Practical Marks', c1, 130, tableY + 6, true);
        drawCell('Obtained Marks', c2, 130, tableY + 6, true);
        drawCell('Total Marks', c3, 165, tableY + 6, true);

        // Table Values
        drawCell(result.theoryMarks.toString(), 20, 130, tableY + 35);
        drawCell(result.practicalMarks.toString(), c1, 130, tableY + 35);
        drawCell(result.obtainedMarks.toString(), c2, 130, tableY + 35);
        drawCell(result.totalMarks.toString(), c3, 165, tableY + 35, true);

        // --- SUMMARY WIDGETS ---
        const summaryY = tableY + 80;
        const wWidth = 175;
        
        const drawWidget = (lbl, val, x, y, valColor = darkText) => {
          doc.roundedRect(x, y, wWidth, 65, 8).strokeColor(borderColor).lineWidth(1).stroke();
          doc.fillColor(lightText).font('Helvetica').fontSize(10).text(lbl, x, y + 15, { width: wWidth, align: 'center' });
          doc.fillColor(valColor).font('Helvetica-Bold').fontSize(22).text(val, x, y + 32, { width: wWidth, align: 'center' });
        };

        drawWidget('Percentage', `${result.percentage.toFixed(1)}%`, 20, summaryY);
        drawWidget('Grade', result.grade, 210, summaryY);
        
        const statusColor = result.status === 'PASS' ? '#16A34A' : '#DC2626';
        drawWidget('Result Status', result.status, 400, summaryY, statusColor);

        // --- DECLARATION ---
        doc.fillColor(lightText).font('Helvetica-Oblique').fontSize(8)
          .text('Errors and omissions are accepted. This is a computer-generated document and does not require physical signature.', 20, summaryY + 85, { width: 555, align: 'center' });

        // --- FOOTER ---
        const footerY = 780;
        doc.rect(20, footerY, 555, 20).fill(primaryColor);
        doc.fillColor('#FFFFFF').font('Helvetica').fontSize(7.5);
        doc.text('www.hunarmandpunjab.pk', 35, footerY + 6);
        doc.text('042-111-486-486', 210, footerY + 6, { width: 200, align: 'center' });
        doc.text(`Issued On: ${new Date().toLocaleDateString()}`, 440, footerY + 6, { align: 'right', width: 120 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new ResultPdfService();
