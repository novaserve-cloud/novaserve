/**
 * Email Queue Handler
 */

export async function process(event: { to: string; template: string }) {
  console.log(`Processing email to ${event.to} with template ${event.template}`);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Email sent successfully" }),
  };
}
