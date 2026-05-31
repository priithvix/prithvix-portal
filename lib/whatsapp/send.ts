/** Send WhatsApp Cloud API text message (server-side). */
export async function sendWhatsAppText(args: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  body: string;
}): Promise<boolean> {
  const url = `https://graph.facebook.com/v21.0/${args.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: args.toE164.replace(/\D/g, ''),
      type: 'text',
      text: { preview_url: false, body: args.body },
    }),
  });
  return res.ok;
}
