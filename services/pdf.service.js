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
            const base64Data = candidate.profileImage.replace(/^data:image\/\w+;base64,/, '');
            photoBuffer = Buffer.from(base64Data, 'base64');
          } else {
            const photoPath = path.join(__dirname, '../public', candidate.profileImage);
            if (fs.existsSync(photoPath)) {
              photoBuffer = fs.readFileSync(photoPath);
            }
          }
        }
        const hasPhoto = photoBuffer !== null;

        const logoPath = path.join(__dirname, '../public/logo.png');
        const hasLogo = fs.existsSync(logoPath);

        // --- TOP BORDER ---
        doc.rect(20, 10, 555, 6).fill(primaryColor);

        // --- TOP SECTION (HEADER) ---
        // Government logo and text
        if (hasLogo) {
          doc.image(logoPath, 20, 22, { width: 55 });
        }
        doc.fillColor(primaryColor)
          .font('Helvetica-Bold')
          .fontSize(16)
          .text('HUNARMAND', 85, 32);
        doc.text('PUNJAB', 85, 50);

        // Vertical divider
        doc.moveTo(175, 25).lineTo(175, 75).strokeColor('#CBD5E1').lineWidth(1.5).stroke();

        // Center branding text
        doc.fillColor(primaryColor)
          .font('Helvetica-Bold')
          .fontSize(19)
          .text('HUNARMAND PUNJAB PROGRAM', 190, 32, { align: 'left' });

        doc.fillColor(lightText)
          .font('Helvetica')
          .fontSize(9.5)
          .text('Building Skills for a Brighter Future', 190, 54, { align: 'left' });

        // QR Code Box (Top Right)
        doc.image(qrCodeBuffer, 485, 20, { width: 70 });
        doc.roundedRect(485, 95, 70, 12, 3).fill(primaryColor);
        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(5.5)
          .text('Scan to Verify', 485, 98, { width: 70, align: 'center' });

        // Divider
        doc.moveTo(20, 115).lineTo(575, 115).strokeColor(borderColor).lineWidth(1).stroke();

        // --- ADMIT CARD BADGE ---
        // Side connector lines with circles
        doc.moveTo(20, 137).lineTo(195, 137).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(195, 137, 3).fill(primaryColor);

        doc.moveTo(400, 137).lineTo(575, 137).strokeColor(primaryColor).lineWidth(1.2).stroke();
        doc.circle(400, 137, 3).fill(primaryColor);

        // Badge pill
        doc.roundedRect(205, 125, 185, 24, 12).fill(primaryColor);
        
        // ID card icon inside badge
        doc.save();
        doc.strokeColor('#FFFFFF').lineWidth(1.2);
        doc.roundedRect(223, 131, 12, 10, 1.5).stroke();
        doc.rect(225, 134, 2.5, 3).fill('#FFFFFF');
        doc.moveTo(229, 134).lineTo(232, 134).stroke();
        doc.moveTo(229, 137).lineTo(231, 137).stroke();
        doc.restore();

        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('ADMIT CARD', 238, 131, { width: 140, align: 'left' });

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

        const testNo = `EXAM-2026-${candidate.rollNumber.split('-').pop() || '000000'}`;
        const testDate = '20 June, 2026 (Saturday)';
        const reportingTime = '08:30 AM';
        const testCenter = candidate.preferredExamCity || 'Lahore';

        // Column 1 (Left Details)
        drawGridItem('Test No', testNo, 20, 160, 210, 35, 'document');
        drawGridItem('Candidate Name', candidate.fullName, 20, 203, 210, 35, 'user');
        drawGridItem('CNIC', candidate.cnic, 20, 246, 210, 35, 'card');
        drawGridItem('Test Center', testCenter, 20, 289, 210, 35, 'map-pin');
        drawGridItem('Reporting Time', reportingTime, 20, 332, 210, 35, 'clock');

        // Column 2 (Middle Details)
        drawGridItem('Roll No', candidate.rollNumber, 245, 160, 210, 35, 'card');
        drawGridItem('Father Name', candidate.fatherName, 245, 203, 210, 35, 'user');
        drawGridItem('Applied Course', candidate.course, 245, 246, 210, 78, 'graduation-cap');
        drawGridItem('Test Date', testDate, 245, 332, 210, 35, 'calendar');

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
          'Candidates must bring their original CNIC/B-Form and this Admit Card on the day of examination.',
          'Without a valid Admit Card, entry to the examination center will not be allowed.',
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
          'Ensure that all details on this Admit Card are correct. In case of any issue, contact the helpdesk immediately.'
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

        doc.fillColor(darkText).font('Helvetica-Bold').fontSize(7.5).text('This is a computer generated Admit Card.', 47, footerY + 22);
        doc.fillColor(lightText).font('Helvetica').fontSize(7).text('No signature is required.', 47, footerY + 32);

        // Center Barcode
        const drawBarcode = (x, y) => {
          doc.save();
          // Pseudo Code-128 barcode pattern
          const pattern = [2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 3, 1, 1, 2, 2, 3, 1, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 3, 1, 1, 2, 2, 3, 1, 1];
          let currentX = x;
          doc.fillColor('#000000');
          for (let i = 0; i < pattern.length; i++) {
            const width = pattern[i];
            if (i % 2 === 0) {
              doc.rect(currentX, y, width, 22).fill();
            }
            currentX += width + 1;
          }
          doc.restore();
        };

        drawBarcode(242, footerY + 16);
        doc.fillColor(lightText).font('Helvetica').fontSize(7.5).text(`${testNo}-${candidate.rollNumber.split('-').pop()}`, 220, footerY + 42, { align: 'center', width: 130 });

        // Right Issued by Govt
        if (hasLogo) {
          doc.image(logoPath, 415, footerY + 16, { width: 28 });
        }
        doc.fillColor(darkText).font('Helvetica-Bold').fontSize(7.5).text('Issued by:', 450, footerY + 18);
        doc.fillColor(lightText).font('Helvetica').fontSize(7).text('Hunarmand Punjab Program', 450, footerY + 27);
        doc.fillColor(lightText).font('Helvetica').fontSize(6.5).text('Government of Punjab', 450, footerY + 36);

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
