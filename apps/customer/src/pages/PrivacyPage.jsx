import { motion } from 'framer-motion';

export default function PrivacyPage() {
  const sections = [
    {
      title: '1. Information We Collect',
      content: [
        'When you use TableBooker, we may collect the following information:',
        '- Personal details: Name, surname, phone number provided during reservation.',
        '- Usage data: Pages visited, search queries, restaurants viewed, and reservation history.',
        '- Device information: Browser type, operating system, and screen resolution for optimal experience.',
        '- Location data: Only when explicitly permitted, to show nearby restaurants.',
      ],
    },
    {
      title: '2. How We Use Your Information',
      content: [
        'We use collected information to:',
        '- Process and confirm your restaurant reservations.',
        '- Send reservation confirmations and reminders via SMS.',
        '- Improve our platform based on usage patterns and feedback.',
        '- Personalize your experience with relevant restaurant recommendations.',
        '- Communicate important updates about our service.',
      ],
    },
    {
      title: '3. Data Storage',
      content: [
        'TableBooker stores reservation data locally in your browser (LocalStorage) for demonstration purposes. In a production environment, data would be stored on secure, encrypted servers with industry-standard protection measures.',
        'We retain your reservation history for 12 months to allow you to reference past bookings.',
      ],
    },
    {
      title: '4. Data Sharing',
      content: [
        'We do not sell your personal information to third parties. We may share limited data with:',
        '- Partner restaurants: Your name, phone number, party size, and special requests to fulfill your reservation.',
        '- Service providers: Trusted partners who assist in operating our platform (e.g., SMS delivery).',
        '- Legal requirements: When required by law or to protect our legal rights.',
      ],
    },
    {
      title: '5. Your Rights',
      content: [
        'You have the right to:',
        '- Access: Request a copy of all personal data we hold about you.',
        '- Correction: Update or correct inaccurate personal information.',
        '- Deletion: Request removal of your personal data from our systems.',
        '- Portability: Receive your data in a structured, machine-readable format.',
        '- Withdraw consent: Opt out of marketing communications at any time.',
      ],
    },
    {
      title: '6. Cookies & Local Storage',
      content: [
        'TableBooker uses browser local storage to save your reservation data and preferences. We do not use tracking cookies for advertising purposes.',
        'Essential storage is required for the platform to function properly (e.g., maintaining your reservation progress).',
      ],
    },
    {
      title: '7. Security',
      content: [
        'We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.',
        'While no system is 100% secure, we continuously review and improve our security practices.',
      ],
    },
    {
      title: '8. Changes to This Policy',
      content: [
        'We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our platform.',
        'Continued use of TableBooker after changes constitutes acceptance of the updated policy.',
      ],
    },
    {
      title: '9. Contact Us',
      content: [
        'If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:',
        '- Email: privacy@tablebooker.ge',
        '- Phone: +995 555 000 000',
        '- Address: 1 Freedom Square, Tbilisi, Georgia',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white mb-3"
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-300"
          >
            Last updated: June 1, 2026
          </motion.p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-10"
        >
          <p className="text-gray-600 mb-8 leading-relaxed">
            At TableBooker, we take your privacy seriously. This Privacy Policy explains how we collect,
            use, store, and protect your personal information when you use our restaurant reservation platform.
          </p>

          <div className="space-y-8">
            {sections.map((section, index) => (
              <div key={index}>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h2>
                <div className="space-y-2">
                  {section.content.map((line, i) => (
                    <p key={i} className={`text-gray-600 leading-relaxed ${line.startsWith('-') ? 'pl-4' : ''}`}>
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
