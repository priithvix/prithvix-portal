'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpCircle, Phone, Mail, MessageCircle, Book } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function HelpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      toast.success('Support request submitted successfully');
      setName('');
      setEmail('');
      setMessage('');
      setIsSubmitting(false);
    }, 1000);
  };

  const faqs = [
    {
      question: 'How do I register a new farmer?',
      answer:
        'Navigate to the Farmers section and click "Register Farmer". Fill in the required details including name, mobile, village, and crop information.',
    },
    {
      question: 'How do I generate an invoice?',
      answer:
        'After completing a sale in the Log Visit section, navigate to the Invoice section to view and download the PDF invoice.',
    },
    {
      question: 'How do I track credit (udhaar)?',
      answer:
        'Go to the Udhaar section to view all credit transactions. You can record payments and view outstanding balances for each farmer.',
    },
    {
      question: 'How do I manage inventory?',
      answer:
        'Access the Inventory section to add products, manage stock levels, and track inventory movements. The system will alert you when stock is low.',
    },
    {
      question: 'How do I add staff members?',
      answer:
        'Only dealers can add staff. Go to Staff Management and click "Add Staff". Assign appropriate roles and permissions.',
    },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Help & Support
        </h1>
        <p className="mt-1 text-muted-foreground">
          Get help with using PrithviX Partner
        </p>
      </div>

      {/* Contact Methods */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-3 rounded-full bg-primary/10 p-3">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <p className="font-semibold">Call Us</p>
            <p className="text-sm text-muted-foreground">Mon-Sat, 9AM-6PM</p>
            <Button variant="link" className="mt-2">
              1800-XXX-XXXX
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-3 rounded-full bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <p className="font-semibold">Email Us</p>
            <p className="text-sm text-muted-foreground">We'll respond within 24h</p>
            <Button variant="link" className="mt-2">
              support@prithvix.com
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-3 rounded-full bg-primary/10 p-3">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <p className="font-semibold">WhatsApp</p>
            <p className="text-sm text-muted-foreground">Chat with support</p>
            <Button variant="link" className="mt-2">
              +91 XXXXX-XXXXX
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle>Submit a Support Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              rows={5}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Describe your issue or question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                <p className="font-semibold text-foreground">{faq.question}</p>
                <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
