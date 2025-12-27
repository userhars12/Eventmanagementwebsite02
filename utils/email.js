const nodemailer = require('nodemailer');
const logger = require('./logger');

class EmailService {
  constructor() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email configuration error:', error);
        } else {
          logger.info('Email server is ready to send messages');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }

  async sendEmail(options) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not initialized, skipping email send');
        return {
          success: false,
          message: 'Email service not available'
        };
      }

      const mailOptions = {
        from: `${process.env.FROM_NAME || 'CampusEvents'} <${process.env.EMAIL_FROM}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
        text: options.text
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: options.email,
        subject: options.subject
      });

      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      logger.error('Email sending failed:', error);
      throw new Error('Email could not be sent');
    }
  }

  // Welcome email template
  async sendWelcomeEmail(user) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to CampusEvents</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to CampusEvents! 🎓</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.firstName}!</h2>
            <p>Thank you for joining CampusEvents, the ultimate platform for discovering and managing campus events.</p>
            
            <p>Here's what you can do:</p>
            <ul>
              <li>🎯 Discover amazing events on your campus</li>
              <li>📅 Create and manage your own events</li>
              <li>🎟️ Get QR code tickets for easy check-in</li>
              <li>🏆 Earn certificates for attended events</li>
              <li>📊 Track your event history and achievements</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Explore Events</a>
            </div>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            
            <p>Best regards,<br>The CampusEvents Team</p>
          </div>
          <div class="footer">
            <p>© 2024 CampusEvents. All rights reserved.</p>
            <p>You received this email because you signed up for CampusEvents.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      email: user.email,
      subject: 'Welcome to CampusEvents! 🎉',
      html
    });
  }

  // Email verification template
  async sendEmailVerification(user, verificationUrl) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email Address 📧</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.firstName}!</h2>
            <p>Please verify your email address to complete your CampusEvents registration.</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${verificationUrl}</p>
            
            <p><strong>This link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with CampusEvents, please ignore this email.</p>
            
            <p>Best regards,<br>The CampusEvents Team</p>
          </div>
          <div class="footer">
            <p>© 2024 CampusEvents. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      email: user.email,
      subject: 'Verify Your CampusEvents Account',
      html
    });
  }

  // Event registration confirmation
  async sendRegistrationConfirmation(user, event, registration) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
          .qr-code { text-align: center; margin: 20px 0; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Registration Confirmed! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.firstName}!</h2>
            <p>Your registration for the following event has been confirmed:</p>
            
            <div class="event-details">
              <h3>${event.title}</h3>
              <p><strong>📅 Date:</strong> ${new Date(event.dateTime.start).toLocaleDateString()}</p>
              <p><strong>🕒 Time:</strong> ${new Date(event.dateTime.start).toLocaleTimeString()}</p>
              <p><strong>📍 Venue:</strong> ${event.venue.name}</p>
              <p><strong>🎫 Registration ID:</strong> ${registration._id}</p>
              ${event.pricing.type === 'paid' ? `<p><strong>💰 Amount Paid:</strong> ₹${registration.paymentDetails.amount}</p>` : '<p><strong>💰 Registration:</strong> FREE</p>'}
            </div>
            
            <div class="qr-code">
              <p><strong>Your QR Code Ticket:</strong></p>
              <p>Show this QR code at the event for quick check-in:</p>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${registration.qrCode.code}" alt="QR Code" style="border: 2px solid #ddd; padding: 10px;">
              <p style="font-size: 12px; color: #666;">QR Code: ${registration.qrCode.code}</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/events/${event._id}" class="button">View Event Details</a>
              <a href="${process.env.FRONTEND_URL}/my-tickets" class="button">My Tickets</a>
            </div>
            
            <p><strong>Important Notes:</strong></p>
            <ul>
              <li>Please arrive 15 minutes before the event starts</li>
              <li>Bring a valid ID for verification</li>
              <li>Save this email or screenshot the QR code</li>
              <li>Contact the organizer if you need to cancel</li>
            </ul>
            
            <p>We're excited to see you at the event!</p>
            
            <p>Best regards,<br>The CampusEvents Team</p>
          </div>
          <div class="footer">
            <p>© 2024 CampusEvents. All rights reserved.</p>
            <p>Event organized by: ${event.contact.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      email: user.email,
      subject: `Registration Confirmed: ${event.title}`,
      html
    });
  }

  // Send registration details to event owner
  async sendRegistrationNotificationToOwner(organizer, event, registration, studentDetails) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Registration for Your Event</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .student-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
          .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Registration! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hello ${organizer.firstName}!</h2>
            <p>A new student has registered for your event:</p>
            
            <div class="event-details">
              <h3>${event.title}</h3>
              <p><strong>📅 Date:</strong> ${new Date(event.dateTime.start).toLocaleDateString()}</p>
              <p><strong>🕒 Time:</strong> ${new Date(event.dateTime.start).toLocaleTimeString()}</p>
              <p><strong>📍 Venue:</strong> ${event.venue.name}</p>
              <p><strong>🎫 Registration ID:</strong> ${registration._id}</p>
            </div>

            <div class="student-details">
              <h3>Student Details</h3>
              <p><strong>👤 Name:</strong> ${studentDetails.firstName} ${studentDetails.lastName}</p>
              <p><strong>📧 Email:</strong> ${studentDetails.email}</p>
              <p><strong>📱 Phone:</strong> ${studentDetails.phone}</p>
              <p><strong>🎂 Date of Birth:</strong> ${new Date(studentDetails.dateOfBirth).toLocaleDateString()}</p>
              <p><strong>👥 Gender:</strong> ${studentDetails.gender}</p>
              <p><strong>🏫 University:</strong> ${studentDetails.university}</p>
              <p><strong>📚 Course:</strong> ${studentDetails.course}</p>
              <p><strong>📊 Year:</strong> ${studentDetails.year}</p>
              <p><strong>🆔 Roll Number:</strong> ${studentDetails.rollNumber}</p>
              
              <h4>Address</h4>
              <p>${studentDetails.address.street}, ${studentDetails.address.city}, ${studentDetails.address.state} - ${studentDetails.address.zipCode}, ${studentDetails.address.country}</p>
              
              <h4>Emergency Contact</h4>
              <p><strong>Name:</strong> ${studentDetails.emergencyContact.name}</p>
              <p><strong>Relationship:</strong> ${studentDetails.emergencyContact.relationship}</p>
              <p><strong>Phone:</strong> ${studentDetails.emergencyContact.phone}</p>
              
              ${studentDetails.dietaryRestrictions && studentDetails.dietaryRestrictions.length > 0 ? 
                `<p><strong>🍽️ Dietary Restrictions:</strong> ${studentDetails.dietaryRestrictions.join(', ')}</p>` : ''}
              ${studentDetails.medicalConditions && studentDetails.medicalConditions.length > 0 ? 
                `<p><strong>🏥 Medical Conditions:</strong> ${studentDetails.medicalConditions.join(', ')}</p>` : ''}
              ${studentDetails.tshirtSize ? `<p><strong>👕 T-Shirt Size:</strong> ${studentDetails.tshirtSize}</p>` : ''}
              ${studentDetails.specialRequirements ? `<p><strong>📝 Special Requirements:</strong> ${studentDetails.specialRequirements}</p>` : ''}
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/organizer/events/${event._id}/registrations" class="button">View All Registrations</a>
              <a href="${process.env.FRONTEND_URL}/organizer/events/${event._id}" class="button">Manage Event</a>
            </div>
            
            <p>Total registrations for this event: <strong>${event.registration.currentAttendees + 1}</strong></p>
            
            <p>Best regards,<br>The CampusEvents Team</p>
          </div>
          <div class="footer">
            <p>© 2024 CampusEvents. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      email: organizer.email,
      subject: `New Registration: ${studentDetails.firstName} ${studentDetails.lastName} - ${event.title}`,
      html
    });
  }

  // Event reminder
  async sendEventReminder(user, event, reminderType) {
    const timeMap = {
      '1week': '1 week',
      '3days': '3 days',
      '1day': '1 day',
      '2hours': '2 hours',
      '30minutes': '30 minutes'
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Event Reminder ⏰</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.firstName}!</h2>
            <p>This is a reminder that your registered event is starting in <strong>${timeMap[reminderType]}</strong>:</p>
            
            <div class="event-details">
              <h3>${event.title}</h3>
              <p><strong>📅 Date:</strong> ${new Date(event.dateTime.start).toLocaleDateString()}</p>
              <p><strong>🕒 Time:</strong> ${new Date(event.dateTime.start).toLocaleTimeString()}</p>
              <p><strong>📍 Venue:</strong> ${event.venue.name}</p>
              ${event.venue.address ? `<p><strong>📍 Address:</strong> ${event.venue.address.street}, ${event.venue.address.city}</p>` : ''}
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/events/${event._id}" class="button">View Event Details</a>
            </div>
            
            <p><strong>Don't forget to:</strong></p>
            <ul>
              <li>Bring your QR code ticket (check your email)</li>
              <li>Arrive 15 minutes early</li>
              <li>Bring a valid ID</li>
              <li>Check for any last-minute updates</li>
            </ul>
            
            <p>See you there!</p>
            
            <p>Best regards,<br>The CampusEvents Team</p>
          </div>
          <div class="footer">
            <p>© 2024 CampusEvents. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      email: user.email,
      subject: `Reminder: ${event.title} starts in ${timeMap[reminderType]}`,
      html
    });
  }

  // Password reset email
  async sendPasswordReset(user, resetUrl) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444, #f59e0b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password 🔐</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.firstName}!</h2>
            <p>You requested to reset your password for your CampusEvents account.</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #ef4444;">${resetUrl}</p>
            
            <p><strong>This link will expire in 10 minutes.</strong></p>
            
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
            
            <p>Best regards,<br>The CampusEvents Team</p>
          </div>
          <div class="footer">
            <p>© 2024 CampusEvents. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      email: user.email,
      subject: 'Reset Your CampusEvents Password',
      html
    });
  }
}

module.exports = new EmailService();