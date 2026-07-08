const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

let ArabicShaper;
try {
  ArabicShaper = require('arabic-persian-reshaper').ArabicShaper;
} catch (e) {}

class PdfService {
  async generateAdmitCard(candidate, hostUrl) {
    return new Promise(async (resolve, reject) => {
      try {
        // Create A4 PDF (595.28 x 841.89 points)
        const doc = new PDFDocument({ size: 'A4', margin: 20 });
        const chunks = [];
        
        // Register custom signature font
        const fontPath = path.join(__dirname, '../assets/GreatVibes-Regular.ttf');
        if (fs.existsSync(fontPath)) {
          doc.registerFont('SignatureFont', fontPath);
        }

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
            // Old format: file path or absolute URL
            let imageUrl = candidate.profileImage;
            
            if (candidate.profileImage.startsWith('http')) {
              // It's already a full URL, use it directly
              imageUrl = candidate.profileImage;
            } else {
              // Try disk first for relative paths
              const photoPath = path.join(__dirname, '../public', candidate.profileImage);
              if (fs.existsSync(photoPath)) {
                photoBuffer = fs.readFileSync(photoPath);
              } else {
                // Construct fallback URL
                const PRODUCTION_URL = 'https://exambackend.neip.org.pk';
                imageUrl = `${PRODUCTION_URL}${candidate.profileImage.startsWith('/') ? '' : '/'}${candidate.profileImage}`;
              }
            }

            if (!photoBuffer) {
              // Fetch via HTTP/HTTPS
              try {
                const httpModule = imageUrl.startsWith('https') ? require('https') : require('http');
                photoBuffer = await new Promise((resolve, reject) => {
                  httpModule.get(imageUrl, (res) => {
                    if (res.statusCode >= 300) {
                      return reject(new Error(`Status ${res.statusCode}`));
                    }
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
                console.error('Error fetching candidate image:', e.message);
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
          
          doc.fillColor(lightText).font('Helvetica').fontSize(7.5).text(label, x + 35, y + 4);
          doc.fillColor(darkText).font('Helvetica-Bold').fontSize(8.5).text(value || 'N/A', x + 35, y + 14, { width: w - 45 });
        };

        const getExamRoomDetails = (course, examSeqNum) => {
          let floor = 'TBD';
          let room = 'TBD';
          let examTime = '10:00 AM – 11:15 AM'; // default
          const rollNum = parseInt(examSeqNum, 10);
          
          if (!rollNum || isNaN(rollNum)) return { floor, room, examTime };

          const c = (course || '').trim().toUpperCase();

          // SLOT 1
          if (c === 'ARTIFICIAL INTELLIGENCE (AI)') {
            examTime = '10:00 AM – 11:15 AM';
            if (rollNum >= 1 && rollNum <= 75) { floor = 'Ground Floor'; room = 'Room 107'; }
            else if (rollNum >= 76 && rollNum <= 120) { floor = 'Ground Floor'; room = 'Room 109'; }
            else if (rollNum >= 121 && rollNum <= 165) { floor = 'Ground Floor'; room = 'Room 110'; }
            else if (rollNum >= 166 && rollNum <= 200) { floor = 'Ground Floor'; room = 'Room 111'; }
            else if (rollNum >= 201 && rollNum <= 249) { floor = 'First Floor'; room = 'Library'; }
          } else if (c === 'FOREX TRADING') {
            examTime = '10:00 AM – 11:15 AM';
            if (rollNum >= 1 && rollNum <= 40) { floor = 'First Floor'; room = 'Room 206'; }
            else if (rollNum >= 41 && rollNum <= 77) { floor = 'Second Floor'; room = 'Room 317'; }
          } else if (c === 'UI/UX DESIGNING FOR WEB & APP') {
            examTime = '10:00 AM – 11:15 AM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 28) room = 'Room 207';
            else if (rollNum >= 29 && rollNum <= 56) room = 'Room 208';
          } else if (c === 'SEARCH ENGINE OPTIMIZATION (SEO)') {
            examTime = '10:00 AM – 11:15 AM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 40) room = 'Room 211';
          } else if (c === 'WORDPRESS WEBSITE DEVELOPMENT') {
            examTime = '10:00 AM – 11:15 AM';
            if (rollNum >= 1 && rollNum <= 13) { floor = 'First Floor'; room = 'Room 214'; }
            else if (rollNum >= 14 && rollNum <= 53) { floor = 'Second Floor'; room = 'Room 314'; }
          } else if (c === 'REACT & NODE.JS FULL STACK DEVELOPMENT') {
            examTime = '10:00 AM – 11:15 AM';
            floor = 'Second Floor';
            if (rollNum >= 1 && rollNum <= 52) room = 'Room 315';
          } else if (c === 'PENETRATION TESTING WEB HACKING') {
            examTime = '10:00 AM – 11:15 AM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 24) room = 'Library';
          }
          // SLOT 2
          else if (c === 'FULL STACK DIGITAL MARKETING & AI') {
            examTime = '12:00 PM – 1:15 PM';
            if (rollNum >= 1 && rollNum <= 75) { floor = 'Ground Floor'; room = 'Room 107'; }
            else if (rollNum >= 76 && rollNum <= 120) { floor = 'Ground Floor'; room = 'Room 109'; }
            else if (rollNum >= 121 && rollNum <= 165) { floor = 'Ground Floor'; room = 'Room 110'; }
            else if (rollNum >= 166 && rollNum <= 200) { floor = 'Ground Floor'; room = 'Room 111'; }
            else if (rollNum >= 201 && rollNum <= 249) { floor = 'First Floor'; room = 'Library'; }
          } else if (c === 'TEXTILE DESIGNING') {
            examTime = '12:00 PM – 1:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 16) room = 'Room 207';
          } else if (c === 'ADVANCED GOOGLE ADS') {
            examTime = '12:00 PM – 1:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 14) room = 'Room 207';
          } else if (c === 'MERN STACK WEB DEVELOPMENT') {
            examTime = '12:00 PM – 1:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 30) room = 'Room 208';
            else if (rollNum >= 31 && rollNum <= 66) room = 'Room 211';
          } else if (c === 'DIGITAL EMBROIDERY') {
            examTime = '12:00 PM – 1:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 7) room = 'Room 214';
          } else if (c === 'FLUTTER APP DEVELOPMENT' || c === 'CROSS PLATFORM FLUTTER APP DEVELOPMENT') {
            examTime = '12:00 PM – 1:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 18) room = 'Library';
          } else if (c === 'PHP LARAVEL WEB DEVELOPMENT') {
            examTime = '12:00 PM – 1:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 8) room = 'Library';
          } else if (c === 'NATIONAL CYBER SECURITY') {
            examTime = '12:00 PM – 1:15 PM';
            floor = 'Second Floor';
            if (rollNum >= 1 && rollNum <= 50) room = 'Room 314';
            else if (rollNum >= 51 && rollNum <= 105) room = 'Room 315';
            else if (rollNum >= 106 && rollNum <= 141) room = 'Room 317';
          }
          // SLOT 3
          else if (c === 'IELTS PREPARATION') {
            examTime = '2:00 PM – 3:15 PM';
            floor = 'Ground Floor';
            if (rollNum >= 1 && rollNum <= 75) room = 'Room 107';
            else if (rollNum >= 76 && rollNum <= 120) room = 'Room 109';
            else if (rollNum >= 121 && rollNum <= 165) room = 'Room 110';
            else if (rollNum >= 166 && rollNum <= 192) room = 'Room 111';
          } else if (c === 'FREELANCING PROGRAM') {
            examTime = '2:00 PM – 3:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 40) room = 'Room 206';
            else if (rollNum >= 41 && rollNum <= 67) room = 'Room 207';
            else if (rollNum >= 68 && rollNum <= 112) room = 'Room 211';
          } else if (c === 'PYTHON PROGRAMMING FOR EVERYONE') {
            examTime = '2:00 PM – 3:15 PM';
            if (rollNum >= 1 && rollNum <= 75) { floor = 'First Floor'; room = 'Library'; }
            else if (rollNum >= 76 && rollNum <= 124) { floor = 'Second Floor'; room = 'Room 314'; }
          } else if (c === 'YOUTUBE MONETIZATION') {
            examTime = '2:00 PM – 3:15 PM';
            floor = 'Second Floor';
            if (rollNum >= 1 && rollNum <= 40) room = 'Room 315';
            else if (rollNum >= 41 && rollNum <= 72) room = 'Room 317';
          }
          // SLOT 4
          else if (c === 'MACHINE LEARNING & DATA SCIENCE') {
            examTime = '4:00 PM – 5:15 PM';
            if (rollNum >= 1 && rollNum <= 65) { floor = 'Ground Floor'; room = 'Room 107'; }
            else if (rollNum >= 66 && rollNum <= 102) { floor = 'First Floor'; room = 'Room 211'; }
          } else if (c === 'SHOPIFY & DARAZ BUSINESS') {
            examTime = '4:00 PM – 5:15 PM';
            if (rollNum >= 1 && rollNum <= 40) { floor = 'Ground Floor'; room = 'Room 109'; }
            else if (rollNum >= 41 && rollNum <= 80) { floor = 'Ground Floor'; room = 'Room 110'; }
            else if (rollNum >= 81 && rollNum <= 98) { floor = 'First Floor'; room = 'Room 210'; }
          } else if (c === 'VIDEO EDITING & ANIMATION') {
            examTime = '4:00 PM – 5:15 PM';
            if (rollNum >= 1 && rollNum <= 24) { floor = 'Ground Floor'; room = 'Room 111'; }
            else if (rollNum >= 25 && rollNum <= 54) { floor = 'First Floor'; room = 'Room 206'; }
            else if (rollNum >= 55 && rollNum <= 84) { floor = 'First Floor'; room = 'Room 208'; }
          } else if (c === 'AMAZON VIRTUAL ASSISTANT') {
            examTime = '4:00 PM – 5:15 PM';
            floor = 'First Floor';
            if (rollNum >= 1 && rollNum <= 21) room = 'Room 207';
            else if (rollNum >= 22 && rollNum <= 86) room = 'Library';
          } else if (c === 'FULL STACK GRAPHIC DESIGNING & AI') {
            examTime = '4:00 PM – 5:15 PM';
            floor = 'Second Floor';
            if (rollNum >= 1 && rollNum <= 50) room = 'Room 314';
            else if (rollNum >= 51 && rollNum <= 100) room = 'Room 315';
          }
          
          return { floor, room, examTime };
        };

        const getCourseInitials = (courseName) => {
          if (!courseName) return 'EXAM';
          const words = courseName.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
          if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
          return words.map(w => w[0].toUpperCase()).join('').substring(0, 4);
        };
        const courseInitials = getCourseInitials(candidate.course);
        // Use stored sequential number (assigned at registration), padded to 5 digits
        const examSeqNum = candidate.examSeqNumber || 1;
        const seqNum = String(examSeqNum).padStart(5, '0');
        const testNo = `HP-EXAM-${courseInitials}-${seqNum}`;
        const testDate = '12 July, 2026 (Sunday)';
        const testCenter = 'CHEP Department, Punjab University, Lahore';
        const { floor, room, examTime } = getExamRoomDetails(candidate.course, examSeqNum);
        const roomAssignment = `${floor}, ${room}`;

        // Grid parameters (5 rows)
        const rowHeight = 35;
        const rowGap = 8;
        const y0 = 160;
        const y1 = y0 + rowHeight + rowGap; // 203
        const y2 = y1 + rowHeight + rowGap; // 246
        const y3 = y2 + rowHeight + rowGap; // 289
        const y4 = y3 + rowHeight + rowGap; // 332

        // Column 1 (Left Details)
        drawGridItem('Test No', testNo, 20, y0, 210, rowHeight, 'document');
        drawGridItem('Candidate Name', candidate.fullName, 20, y1, 210, rowHeight, 'user');
        drawGridItem('CNIC', candidate.cnic, 20, y2, 210, rowHeight, 'card');
        drawGridItem('Test Center', testCenter, 20, y3, 210, rowHeight, 'map-pin');
        drawGridItem('Room Assignment', roomAssignment, 20, y4, 210, rowHeight, 'map-pin');

        // Column 2 (Middle Details)
        drawGridItem('Roll No', candidate.rollNumber, 245, y0, 210, rowHeight, 'card');
        drawGridItem('Father Name', candidate.fatherName, 245, y1, 210, rowHeight, 'user');
        drawGridItem('Applied Course', candidate.course, 245, y2, 210, rowHeight, 'graduation-cap');
        drawGridItem('Test Date', testDate, 245, y3, 210, rowHeight, 'calendar');
        drawGridItem('Exam Time', examTime, 245, y4, 210, rowHeight, 'clock');

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

        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text('IMPORTANT INSTRUCTIONS', 45, instY + 7);

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
          'Mobile phones, smart watches, and all other electronic devices must remain strictly powered off within the examination area.',
          'Candidates must bring a blue pen and a clipboard for the examination.'
        ];
        
        let bulletY = instY + 28;
        leftInstructions.forEach((text) => {
          drawInstructionBullet(text, 30, bulletY, 255);
          bulletY += 16;
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
          bulletY += 16;
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
        // Removed "No signature is required." text as requested

        // Roll number in center (barcode removed)
        doc.fillColor(darkText).font('Helvetica-Bold').fontSize(11).text(candidate.rollNumber, 200, footerY + 20, { align: 'center', width: 180 });
        doc.fillColor(lightText).font('Helvetica').fontSize(7).text('Roll Number', 200, footerY + 36, { align: 'center', width: 180 });

        // Right Issued by Govt
        if (hasLogo) {
          doc.image(logoPath, 415, footerY + 16, { width: 28 });
        }
        doc.fillColor(darkText).font('Helvetica-Bold').fontSize(7.5).text('Issued by:', 450, footerY + 14);
        doc.fillColor(lightText).font('Helvetica').fontSize(7).text('Hunarmand Punjab', 450, footerY + 23);
        
        // Signature
        try {
          doc.fillColor('#10b981').font('SignatureFont').fontSize(22).text('Husnain', 448, footerY + 22);
        } catch (err) {
          doc.fillColor('#10b981').font('Times-Italic').fontSize(16).text('Husnain', 448, footerY + 30);
        }
        doc.fillColor(lightText).font('Helvetica-Bold').fontSize(6).text('Exam Controller', 450, footerY + 49);

        // Green footer contact strip
        const contactY = 580;
        doc.rect(20, contactY, 555, 20).fill(primaryColor);
        doc.fillColor('#FFFFFF').font('Helvetica').fontSize(7.5);
        
        // Globe icon, phone icon, mail icon text
        doc.text('www.hunarmandpunjab.pk', 35, contactY + 6);
        doc.text('03 111 133 053 (Mon-Sat: 9:00 AM - Coming soon)', 210, contactY + 6, { width: 200, align: 'center' });
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
          ['Room Assign', roomAssignment],
          ['Test Date', testDate],
          ['Exam Time', examTime]
        ];

        let currentDetailY = detailsY;
        details.forEach(([lbl, val]) => {
          doc.fillColor(lightText).font('Helvetica-Bold').fontSize(7.5).text(lbl, 20, currentDetailY);
          doc.fillColor(darkText).font('Helvetica').fontSize(7.5).text(`:  ${val}`, 90, currentDetailY, { width: 250 });
          currentDetailY += 12;
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
