import nodemailer from "nodemailer";
import Settings from "../models/Settings.js";
import { escapeHtml } from "../utils/validation.js";

function getTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    // Return dummy transporter that logs to console if credentials are not configured
    return {
      sendMail: async (mailOptions) => {
        console.log("Email logging (SMTP not configured):", JSON.stringify(mailOptions, null, 2));
        return { messageId: "dummy-id" };
      }
    };
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendNewBugEmail({ userId, title, severity, description, date }) {
  try {
    const settings = await Settings.findOne({ userId });
    if (!settings || !settings.newBugNotifications) return;

    const to = settings.notificationEmail || settings.supportEmail || "admin@example.com";
    const appName = settings.applicationName || "BugPilot";

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${appName}" <${process.env.EMAIL_USER || "noreply@bugpilot.com"}>`,
      to,
      subject: "New Bug Report Submitted",
      text: `A new bug has been reported on ${appName}.\n\nTitle: ${title}\nSeverity: ${severity}\nDescription: ${description}\nDate/Time: ${date}`,
      html: `
        <h3>New Bug Report Submitted</h3>
        <p>A new bug has been reported on <strong>${escapeHtml(appName)}</strong>.</p>
        <table>
          <tr><td><strong>Title:</strong></td><td>${escapeHtml(title)}</td></tr>
          <tr><td><strong>Severity:</strong></td><td>${escapeHtml(severity)}</td></tr>
          <tr><td><strong>Description:</strong></td><td>${escapeHtml(description)}</td></tr>
          <tr><td><strong>Date/Time:</strong></td><td>${escapeHtml(date)}</td></tr>
        </table>
      `,
    });
    console.log(`New bug email notification sent to ${to}`);
  } catch (err) {
    console.error("Failed to send new bug email:", err);
  }
}

export async function sendStatusChangeEmail({ userId, title, previousStatus, newStatus, date }) {
  try {
    const settings = await Settings.findOne({ userId });
    if (!settings || !settings.statusChangeNotifications) return;

    const to = settings.notificationEmail || settings.supportEmail || "admin@example.com";
    const appName = settings.applicationName || "BugPilot";

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${appName}" <${process.env.EMAIL_USER || "noreply@bugpilot.com"}>`,
      to,
      subject: "Bug Status Updated",
      text: `A bug status has been updated on ${appName}.\n\nBug Title: ${title}\nPrevious Status: ${previousStatus}\nNew Status: ${newStatus}\nUpdated Date/Time: ${date}`,
      html: `
        <h3>Bug Status Updated</h3>
        <p>A bug status has been updated on <strong>${escapeHtml(appName)}</strong>.</p>
        <table>
          <tr><td><strong>Bug Title:</strong></td><td>${escapeHtml(title)}</td></tr>
          <tr><td><strong>Previous Status:</strong></td><td>${escapeHtml(previousStatus)}</td></tr>
          <tr><td><strong>New Status:</strong></td><td>${escapeHtml(newStatus)}</td></tr>
          <tr><td><strong>Updated Date/Time:</strong></td><td>${escapeHtml(date)}</td></tr>
        </table>
      `,
    });
    console.log(`Status change email notification sent to ${to}`);
  } catch (err) {
    console.error("Failed to send status change email:", err);
  }
}
