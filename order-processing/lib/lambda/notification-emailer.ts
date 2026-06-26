/**
 * Notification Emailer - SNS subscriber that forwards order status
 * notifications as email via SES.
 *
 * Sandbox-mode SES requires both the sender and recipient to be verified
 * identities - this demo uses the same verified address for both.
 */

import { SNSEvent } from 'aws-lambda';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { OrderResult } from './types';

const sesClient = new SESv2Client({});

const STATUS_COLORS: Record<string, string> = {
    PAYMENT_COMPLETED: '#22863a',
    PAYMENT_FAILED: '#cb2431',
    PROCESSING_FAILED: '#cb2431',
    CANCELLED: '#6a737d',
    VALIDATION_FAILED: '#cb2431',
};

function buildHtmlBody(result: OrderResult): string {
    const color = STATUS_COLORS[result.status] ?? '#6a737d';

    const itemsRows = (result.items ?? [])
        .map((item) => `
        <tr>
          <td style="padding:6px 12px;border:1px solid #e1e4e8;">${item.productId}</td>
          <td style="padding:6px 12px;border:1px solid #e1e4e8;">${item.quantity}</td>
        </tr>`)
        .join('');

    const itemsTable = itemsRows ? `
      <table style="border-collapse:collapse;margin:12px 0;font-size:14px;">
        <thead>
          <tr>
            <th style="padding:6px 12px;border:1px solid #e1e4e8;text-align:left;background:#f6f8fa;">Product</th>
            <th style="padding:6px 12px;border:1px solid #e1e4e8;text-align:left;background:#f6f8fa;">Qty</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>` : '';

    const amountLine = result.amount !== undefined
        ? `<p style="font-size:15px;"><strong>Total:</strong> $${result.amount.toFixed(2)}</p>`
        : '';

    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#24292e;">
  <h2 style="margin-bottom:4px;font-size:18px;">Order ${result.orderId}</h2>
  <span style="display:inline-block;padding:4px 10px;border-radius:4px;background:${color};color:#fff;font-weight:bold;font-size:12px;letter-spacing:0.5px;">
    ${result.status}
  </span>
  <p style="color:#444;font-size:14px;margin-top:12px;">${result.message}</p>
  ${itemsTable}
  ${amountLine}
  <hr style="border:none;border-top:1px solid #e1e4e8;margin:16px 0;">
  <p style="color:#888;font-size:12px;">
    Received ${result.processingTime.orderReceived}<br>
    Completed ${result.processingTime.orderCompleted}
  </p>
</div>`;
}

export const handler = async (event: SNSEvent): Promise<void> => {
    const notificationEmail = process.env.NOTIFICATION_EMAIL;
    if (!notificationEmail) {
        throw new Error('NOTIFICATION_EMAIL environment variable is not set');
    }

    for (const record of event.Records) {
        const result: OrderResult = JSON.parse(record.Sns.Message);

        await sesClient.send(new SendEmailCommand({
            FromEmailAddress: notificationEmail,
            Destination: { ToAddresses: [notificationEmail] },
            Content: {
                Simple: {
                    Subject: { Data: record.Sns.Subject || `Order ${result.orderId}: ${result.status}` },
                    Body: {
                        Html: { Data: buildHtmlBody(result) },
                        Text: { Data: record.Sns.Message },
                    },
                },
            },
        }));
    }
};
