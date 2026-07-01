const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

class PdfService {
  async generateAdmitCard(candidate, hostUrl) {
    return new Promise(async (resolve, reject) => {
      try {
        // Create A4 PDF (595.28 x 841.89 points)
        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const primaryColor = '#0B5634';
        const darkText = '#1E293B';
        const lightText = '#64748B';
        const lightBg = '#F8FAFC';
        const borderColor = '#CBD5E1';

        // Base URL for Verification scan
        const verifyUrl = `${hostUrl}/admin/verify?token=${candidate.qrSecureToken}`;
        const qrCodeBuffer = await QRCode.toBuffer(verifyUrl, {
          margin: 1,
          width: 200,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        // Parse Student image
        let photoBuffer = null;
        if (candidate.profileImage) {
          if (candidate.profileImage.startsWith('data:image')) {
            // New format: base64 stored directly in MongoDB
            const base64Data = candidate.profileImage.replace(/^data:image\/\w+;base64,/, '');
            photoBuffer = Buffer.from(base64Data, 'base64');
          } else {
            // Old format: file path stored in MongoDB — try disk first, then HTTP fallback
            const photoPath = path.join(__dirname, '../public', candidate.profileImage);
            if (fs.existsSync(photoPath)) {
              photoBuffer = fs.readFileSync(photoPath);
            } else {
              // Fallback: fetch from production server (for local dev against production DB)
              try {
                const PRODUCTION_URL = 'https://exambackend.neip.org.pk';
                const imageUrl = `${PRODUCTION_URL}${candidate.profileImage}`;
                const httpModule = require('https');
                photoBuffer = await new Promise((resolve, reject) => {
                  httpModule.get(imageUrl, (res) => {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => {
                      const buf = Buffer.concat(chunks);
                      resolve(buf.length > 500 ? buf : null);
                    });
                    res.on('error', reject);
                  }).on('error', reject);
                });
              } catch (e) {
                photoBuffer = null;
              }
            }
          }
        }
        const hasPhoto = photoBuffer !== null;

        const logoPath = path.join(__dirname, '../public/logo.png');
        const hasLogo = fs.existsSync(logoPath);

        // ══════════════════════════════════════════════════════
        //  MODERN PROFESSIONAL HEADER
        // ══════════════════════════════════════════════════════

        // Background fill for header area
        doc.rect(20, 10, 555, 98).fill('#F4FAF7');

        // Left vertical green accent strip
        doc.rect(20, 10, 5, 98).fill(primaryColor);

        // Logo
        if (hasLogo) {
          doc.image(logoPath, 32, 18, { width: 62, height: 62 });
        }

        // Org name block (right of logo)
        const orgX = 105;
        doc.fillColor(primaryColor)
          .font('Helvetica-Bold')
          .fontSize(20)
          .text('HUNARMAND PUNJAB', orgX, 24, { characterSpacing: 0.5 });

        // Thin green underline below title
        doc.rect(orgX, 48, 250, 2).fill(primaryColor);

        doc.fillColor('#4A6741')
          .font('Helvetica')
          .fontSize(9)
          .text('Building Skills for a Brighter Future', orgX, 54);

        doc.fillColor(lightText)
          .font('Helvetica')
          .fontSize(7.5)
          .text('Skill Development Initiative | Punjab, Pakistan', orgX, 68);

        // Vertical separator before QR
        doc.moveTo(468, 14).lineTo(468, 104).strokeColor('#D1E8DA').lineWidth(1).stroke();

        // QR code section
        doc.roundedRect(474, 12, 94, 94, 6).fill('#FFFFFF');
        doc.roundedRect(474, 12, 94, 94, 6).strokeColor('#D1E8DA').lineWidth(1).stroke();
        doc.image(qrCodeBuffer, 478, 14, { width: 72, height: 72 });
        doc.roundedRect(478, 90, 72, 13, 3).fill(primaryColor);
        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(6)
          .text('Scan to Verify', 478, 94, { width: 72, align: 'center' });

        // Subtle bottom border of header (thin)
        doc.moveTo(20, 111).lineTo(575, 111).strokeColor('#D1E8DA').lineWidth(0.75).stroke();

        // ══════════════════════════════════════════════════════
        //  ADMIT CARD BADGE (below header)
        // ══════════════════════════════════════════════════════

        // Side connector lines with circles
        doc.moveTo(20, 130).lineTo(195, 130).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(195, 130, 3).fill(primaryColor);

        doc.moveTo(400, 130).lineTo(575, 130).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(400, 130, 3).fill(primaryColor);

        // Badge pill
        doc.roundedRect(200, 119, 195, 23, 11).fill(primaryColor);

        // ID card icon inside badge
        doc.save();
        doc.strokeColor('#FFFFFF').lineWidth(1.2);
        doc.roundedRect(215, 125, 12, 10, 1.5).stroke();
        doc.rect(217, 128, 2.5, 3).fill('#FFFFFF');
        doc.moveTo(221, 128).lineTo(224, 128).stroke();
        doc.moveTo(221, 131).lineTo(223, 131).stroke();
        doc.restore();

        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(10.5)
          .text('ROLL NUMBER SLIP', 222, 125, { width: 170, align: 'center' });

        // Helper to draw vector icons
        const drawIcon = (name, x, y) => {
          doc.save();
          doc.strokeColor('#0B5634').fillColor('#0B5634').lineWidth(1.2);
          if (name === 'document') {
            doc.roundedRect(x + 2, y + 2, 12, 14, 1.5).stroke();
            doc.moveTo(x + 5, y + 6).lineTo(x + 11, y + 6).stroke();
            doc.moveTo(x + 5, y + 9).lineTo(x + 11, y + 9).stroke();
            doc.moveTo(x + 5, y + 12).lineTo(x + 9, y + 12).stroke();
          } else if (name === 'user') {
            doc.circle(x + 8, y + 6, 3).fill();
            doc.moveTo(x + 3, y + 13)
               .bezierCurveTo(x + 3, y + 10, x + 13, y + 10, x + 13, y + 13)
               .lineTo(x + 3, y + 13)
               .fill();
          } else if (name === 'card') {
            doc.roundedRect(x + 1, y + 3, 14, 11, 2).stroke();
            doc.rect(x + 4, y + 6, 3, 4).fill();
            doc.moveTo(x + 9, y + 7).lineTo(x + 12, y + 7).stroke();
            doc.moveTo(x + 9, y + 10).lineTo(x + 11, y + 10).stroke();
          } else if (name === 'map-pin') {
            doc.circle(x + 8, y + 6, 3.5).stroke();
            doc.circle(x + 8, y + 6, 1.2).fill();
            doc.moveTo(x + 8, y + 9.5).lineTo(x + 8, y + 14).stroke();
          } else if (name === 'clock') {
            doc.circle(x + 8, y + 8, 6).stroke();
            doc.moveTo(x + 8, y + 8).lineTo(x + 8, y + 5).stroke();
            doc.moveTo(x + 8, y + 8).lineTo(x + 11, y + 8).stroke();
          } else if (name === 'graduation-cap') {
            doc.moveTo(x + 8, y + 3).lineTo(x + 14, y + 6).lineTo(x + 8, y + 9).lineTo(x + 2, y + 6).closePath().fill();
            doc.rect(x + 5, y + 8, 6, 3).fill();
            doc.moveTo(x + 12, y + 6).lineTo(x + 12, y + 12).stroke();
            doc.circle(x + 12, y + 12, 1).fill();
          } else if (name === 'calendar') {
            doc.roundedRect(x + 2, y + 3, 12, 12, 1.5).stroke();
            doc.moveTo(x + 2, y + 7).lineTo(x + 14, y + 7).stroke();
            doc.circle(x + 5, y + 10, 0.8).fill();
            doc.circle(x + 8, y + 10, 0.8).fill();
            doc.circle(x + 11, y + 10, 0.8).fill();
            doc.circle(x + 5, y + 13, 0.8).fill();
            doc.circle(x + 8, y + 13, 0.8).fill();
            doc.circle(x + 11, y + 13, 0.8).fill();
          }
          doc.restore();
        };

        // --- STUDENT DETAILS GRID ---
        const drawGridItem = (label, value, x, y, w, h, iconName) => {
          // Rounded card border
          doc.roundedRect(x, y, w, h, 8).fill('#FFFFFF');
          doc.roundedRect(x, y, w, h, 8).strokeColor(borderColor).lineWidth(0.75).stroke();
          
          // Draw Icon
          if (iconName) {
            drawIcon(iconName, x + 8, y + (h - 18) / 2);
          }
          
          doc.fillColor(lightText).font('Helvetica').fontSize(7.5).text(label, x + 35, y + 6);
          doc.fillColor(darkText).font('Helvetica-Bold').fontSize(8.5).text(value || 'N/A', x + 35, y + 16, { width: w - 45 });
        };

        const getCourseInitials = (courseName) => {
          if (!courseName) return 'EXAM';
          const words = courseName.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
          if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
          return words.map(w => w[0].toUpperCase()).join('').substring(0, 4);
        };
        const courseInitials = getCourseInitials(candidate.course);
        // Use stored sequential number (assigned at registration), padded to 5 digits
        const seqNum = String(candidate.examSeqNumber || 1).padStart(5, '0');
        const testNo = `HP-EXAM-${courseInitials}-${seqNum}`;
        const testDate = '05 July, 2026 (Sunday)';
        const reportingTime = '08:30 AM';
        const testCenter = 'CHEP Department, Punjab University, Lahore';

        // Column 1 (Left Details)
        drawGridItem('Test No', testNo, 20, 160, 210, 35, 'document');
        drawGridItem('Candidate Name', candidate.fullName, 20, 203, 210, 35, 'user');
        drawGridItem('CNIC', candidate.cnic, 20, 246, 210, 35, 'card');
        drawGridItem('Test Center', testCenter, 20, 289, 210, 35, 'map-pin');
        drawGridItem('Reporting Time', reportingTime, 20, 332, 210, 35, 'clock');

        // Column 2 (Middle Details)
        drawGridItem('Roll No', candidate.rollNumber, 245, 160, 210, 35, 'card');
        drawGridItem('Father Name', candidate.fatherName, 245, 203, 210, 35, 'user');
        drawGridItem('Applied Course', candidate.course, 245, 246, 210, 35, 'graduation-cap');
        drawGridItem('Test Date', testDate, 245, 289, 210, 35, 'calendar');

        // Column 3 (Photo Box on Right)
        doc.roundedRect(465, 160, 110, 135, 8).strokeColor(primaryColor).lineWidth(2).stroke();
        if (hasPhoto) {
          doc.save();
          // Clip image to rounded rect
          doc.roundedRect(467, 162, 106, 131, 6).clip();
          doc.image(photoBuffer, 467, 162, { width: 106, height: 131 });
          doc.restore();
        } else {
          doc.fillColor(lightText)
            .font('Helvetica')
            .fontSize(8.5)
            .text('PASSPORT PHOTO', 465, 220, { width: 110, align: 'center' });
        }

        // Candidate Signature (Handwritten look)
        doc.fillColor(darkText)
          .font('Times-Italic')
          .fontSize(22)
          .text(candidate.fullName.split(' ')[0], 465, 305, { width: 110, align: 'center' });

        doc.moveTo(465, 328).lineTo(575, 328).strokeColor(lightText).lineWidth(0.5).stroke();
        doc.fillColor(lightText)
          .font('Helvetica')
          .fontSize(7.5)
          .text('Candidate Signature', 465, 333, { width: 110, align: 'center' });

        // --- IMPORTANT INSTRUCTIONS ---
        const instY = 380;
        doc.roundedRect(20, instY, 555, 125, 8).fill('#F8FAFC');
        doc.roundedRect(20, instY, 555, 125, 8).strokeColor(borderColor).lineWidth(0.75).stroke();
        
        // Instruction Header
        doc.moveTo(20, instY + 22).lineTo(575, instY + 22).strokeColor(borderColor).lineWidth(0.5).stroke();
        
        // Draw green checkmark badge on left of Instructions title
        doc.save();
        doc.circle(32, instY + 11, 7).fill(primaryColor);
        doc.strokeColor('#FFFFFF').lineWidth(1.2);
        doc.moveTo(29.5, instY + 11).lineTo(31.5, instY + 13).lineTo(35, instY + 9).stroke();
        doc.restore();

        doc.fillColor(primaryColor)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('IMPORTANT INSTRUCTIONS', 45, instY + 7);

        // Instruction bullet points helper
        const drawInstructionBullet = (text, x, y, width) => {
          doc.save();
          // Green circle arrow
          doc.circle(x + 4, y + 4, 4.5).fill(primaryColor);
          doc.strokeColor('#FFFFFF').lineWidth(0.8);
          doc.moveTo(x + 2.5, y + 2.5).lineTo(x + 4.5, y + 4).lineTo(x + 2.5, y + 5.5).stroke();
          doc.restore();

          doc.fillColor(darkText)
            .font('Helvetica')
            .fontSize(7.2)
            .text(text, x + 15, y, { width: width - 15, lineGap: 1.5 });
        };

        // Left Col Instructions
        const leftInstructions = [
          'Candidates must bring their original CNIC/B-Form and this Roll No Slip on the day of examination.',
          'Without a valid Roll No Slip, entry to the examination center will not be allowed.',
          'Candidates must reach the examination center at least 30 minutes before the commencement of the paper.',
          'Entry to the examination hall will be closed 15 minutes after the start of the paper.',
          'Mobile phones, smart watches, or any electronic devices are strictly prohibited inside the examination hall.'
        ];
        
        let bulletY = instY + 28;
        leftInstructions.forEach((text) => {
          drawInstructionBullet(text, 30, bulletY, 255);
          bulletY += 18;
        });

        // Right Col Instructions
        const rightInstructions = [
          'Candidates are not allowed to bring any books, notes, or helping material into the examination hall.',
          'Use of unfair means will result in immediate cancellation of the paper and disciplinary action.',
          'Candidates must follow all instructions given by the invigilator/supervisory staff.',
          'Write your Roll Number clearly on the answer sheet in the provided space only.',
          'Ensure that all details on this Roll No Slip are correct. In case of any issue, contact the helpdesk immediately.'
        ];

        bulletY = instY + 28;
        rightInstructions.forEach((text) => {
          drawInstructionBullet(text, 300, bulletY, 260);
          bulletY += 18;
        });

        // --- BARCODE / FOOTER SECTION ---
        const footerY = 515;
        doc.roundedRect(20, footerY, 555, 60, 6).fill('#FFFFFF');
        doc.roundedRect(20, footerY, 555, 60, 6).strokeColor(borderColor).lineWidth(0.75).stroke();
        
        // Left computer generated text with check shield
        doc.save();
        doc.circle(32, footerY + 30, 8).fill(primaryColor);
        doc.strokeColor('#FFFFFF').lineWidth(1.5);
        doc.moveTo(29.5, footerY + 30).lineTo(31.5, footerY + 32).lineTo(35, footerY + 28).stroke();
        doc.restore();

        doc.fillColor(darkText).font('Helvetica-Bold').fontSize(7.5).text('This is a computer generated Roll Number Slip.', 47, footerY + 22);
        doc.fillColor(lightText).font('Helvetica').fontSize(7).text('No signature is required.', 47, footerY + 32);

        // Roll number in center (barcode removed)
        doc.fillColor(darkText).font('Helvetica-Bold').fontSize(11).text(candidate.rollNumber, 200, footerY + 20, { align: 'center', width: 180 });
        doc.fillColor(lightText).font('Helvetica').fontSize(7).text('Roll Number', 200, footerY + 36, { align: 'center', width: 180 });

        // Right Issued by Govt
        if (hasLogo) {
          doc.image(logoPath, 415, footerY + 16, { width: 28 });
        }
        doc.fillColor(darkText).font('Helvetica-Bold').fontSize(7.5).text('Issued by:', 450, footerY + 18);
        doc.fillColor(lightText).font('Helvetica').fontSize(7).text('Hunarmand Punjab', 450, footerY + 27);

        // Green footer contact strip
        const contactY = 580;
        doc.rect(20, contactY, 555, 20).fill(primaryColor);
        doc.fillColor('#FFFFFF').font('Helvetica').fontSize(7.5);
        
        // Globe icon, phone icon, mail icon text
        doc.text('www.hunarmandpunjab.pk', 35, contactY + 6);
        doc.text('042-111-486-486 (Mon-Sat: 9:00 AM - 6:00 PM)', 210, contactY + 6, { width: 200, align: 'center' });
        doc.text('info@hunarmandpunjab.pk', 440, contactY + 6, { align: 'right', width: 120 });

        // --- SCISSORS CUTTING LINE ---
        const scissorY = 610;
        doc.moveTo(20, scissorY).lineTo(575, scissorY).strokeColor(lightText).lineWidth(1).dash(3, { space: 3 }).stroke();
        doc.undash();
        doc.fillColor(lightText).font('Helvetica').fontSize(14).text('\u2702', 285, scissorY - 8);

        // --- OFFICE COPY SECTION ---
        const officeY = 625;
        // Side connector lines with circles
        doc.moveTo(20, officeY + 9).lineTo(210, officeY + 9).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(210, officeY + 9, 3).fill(primaryColor);

        doc.moveTo(385, officeY + 9).lineTo(575, officeY + 9).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(385, officeY + 9, 3).fill(primaryColor);

        // Office Copy Badge
        doc.roundedRect(220, officeY, 155, 18, 9).fill(primaryColor);
        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('OFFICE COPY', 220, officeY + 5, { width: 155, align: 'center' });

        // Table Layout for details
        const detailsY = officeY + 30;
        const details = [
          ['Candidate Name', candidate.fullName],
          ['Father Name', candidate.fatherName],
          ['CNIC', candidate.cnic],
          ['Roll No', candidate.rollNumber],
          ['Test No', testNo],
          ['Applied Course', candidate.course],
          ['Test Center', testCenter],
          ['Test Date', testDate],
          ['Reporting Time', reportingTime]
        ];

        let currentDetailY = detailsY;
        details.forEach(([lbl, val]) => {
          doc.fillColor(lightText).font('Helvetica-Bold').fontSize(7.5).text(lbl, 20, currentDetailY);
          doc.fillColor(darkText).font('Helvetica').fontSize(7.5).text(`:  ${val}`, 110, currentDetailY, { width: 230 });
          currentDetailY += 13;
        });

        // Small Photo with blue border
        const smallPhotoX = 360;
        doc.roundedRect(smallPhotoX, detailsY, 95, 115, 6).strokeColor('#3B82F6').lineWidth(2).stroke();
        if (hasPhoto) {
          doc.save();
          doc.roundedRect(smallPhotoX + 1, detailsY + 1, 93, 113, 5).clip();
          doc.image(photoBuffer, smallPhotoX + 1, detailsY + 1, { width: 93, height: 113 });
          doc.restore();
        } else {
          doc.fillColor(lightText).font('Helvetica').fontSize(6).text('PHOTO', smallPhotoX, detailsY + 50, { width: 95, align: 'center' });
        }

        // Right QR Box (office copy)
        const officeQrX = 480;
        doc.image(qrCodeBuffer, officeQrX, detailsY, { width: 80 });
        doc.roundedRect(officeQrX, detailsY + 83, 80, 12, 3).fill(primaryColor);
        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(6)
          .text('Scan to Verify', officeQrX, detailsY + 86, { width: 80, align: 'center' });

        // Signature lines
        const sigLineY = 780;
        doc.moveTo(350, sigLineY).lineTo(455, sigLineY).strokeColor(lightText).lineWidth(0.5).stroke();
        doc.fillColor(lightText).font('Helvetica').fontSize(6.5).text('Candidate Signature', 350, sigLineY + 4, { width: 105, align: 'center' });

        doc.moveTo(470, sigLineY).lineTo(575, sigLineY).strokeColor(lightText).lineWidth(0.5).stroke();
        doc.fillColor(lightText).font('Helvetica').fontSize(6.5).text('Invigilator Signature', 470, sigLineY + 4, { width: 105, align: 'center' });

        // Note footer at very bottom
        doc.fillColor(lightText)
          .font('Helvetica')
          .fontSize(6.5)
          .text('Note: This slip must be retained by the examination center.', 20, 805, { align: 'center', width: 555 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new PdfService();
