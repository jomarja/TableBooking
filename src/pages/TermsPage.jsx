import { motion } from 'framer-motion';

export default function TermsPage() {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: [
        'By accessing or using TableBooker, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.',
        'We reserve the right to modify these terms at any time. Continued use after modifications constitutes acceptance of the updated terms.',
      ],
    },
    {
      title: '2. Description of Service',
      content: [
        'TableBooker is a restaurant reservation platform that allows users to:',
        '- Search and discover restaurants based on cuisine, location, and preferences.',
        '- View restaurant details including menus, floor plans, and availability.',
        '- Make reservations by selecting dates, party sizes, tables, and time slots.',
        '- Manage and view their reservation history.',
        'TableBooker acts as an intermediary between diners and restaurants. We do not own or operate any restaurants listed on our platform.',
      ],
    },
    {
      title: '3. User Accounts & Reservations',
      content: [
        'When making a reservation, you agree to provide accurate and complete information including your name, phone number, and party size.',
        'You are responsible for honoring your reservations. Repeated no-shows may result in restrictions on your ability to make future reservations.',
        'Reservations are subject to restaurant availability and confirmation. While we strive for accuracy, we cannot guarantee table availability in all circumstances.',
      ],
    },
    {
      title: '4. Cancellation Policy',
      content: [
        'You may cancel or modify your reservation at any time before the scheduled time through our platform.',
        'We encourage cancellation at least 2 hours in advance to allow the restaurant to accommodate other guests.',
        'Individual restaurants may have their own cancellation policies which will be communicated during the booking process.',
      ],
    },
    {
      title: '5. User Conduct',
      content: [
        'You agree not to:',
        '- Provide false or misleading information when making reservations.',
        '- Use the platform for any unlawful purpose or in violation of any applicable laws.',
        '- Attempt to interfere with the proper functioning of the platform.',
        '- Make excessive reservations with no intention of honoring them.',
        '- Harass, abuse, or harm restaurant staff or other users.',
        '- Attempt to access data or accounts not intended for you.',
      ],
    },
    {
      title: '6. Restaurant Information',
      content: [
        'Restaurant information displayed on TableBooker (menus, prices, hours, images) is provided by our restaurant partners and updated regularly.',
        'We make reasonable efforts to ensure accuracy but cannot guarantee that all information is current at all times. Prices, menus, and availability may change without notice.',
        'For the most up-to-date information, we recommend contacting the restaurant directly.',
      ],
    },
    {
      title: '7. Intellectual Property',
      content: [
        'All content on TableBooker, including but not limited to text, graphics, logos, icons, images, and software, is the property of TableBooker or its content providers.',
        'You may not reproduce, distribute, modify, or create derivative works from any content without our explicit written permission.',
        'The TableBooker name, logo, and branding are trademarks and may not be used without authorization.',
      ],
    },
    {
      title: '8. Limitation of Liability',
      content: [
        'TableBooker is provided "as is" without warranties of any kind, either express or implied.',
        'We are not liable for:',
        '- Any issues arising from the restaurant experience itself (food quality, service, etc.).',
        '- Loss or damage resulting from reliance on information provided on our platform.',
        '- Technical interruptions or data loss beyond our reasonable control.',
        '- Actions or omissions of restaurant partners.',
        'Our total liability shall not exceed the amount paid by you for using our service (which is currently free for diners).',
      ],
    },
    {
      title: '9. Dispute Resolution',
      content: [
        'Any disputes arising from the use of TableBooker shall be resolved through good-faith negotiation.',
        'If a resolution cannot be reached, disputes shall be submitted to the courts of Tbilisi, Georgia.',
        'These Terms of Service are governed by the laws of Georgia.',
      ],
    },
    {
      title: '10. Contact Information',
      content: [
        'For questions about these Terms of Service, please contact us:',
        '- Email: legal@tablebooker.ge',
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
            Terms of Service
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
            Welcome to TableBooker. These Terms of Service govern your use of our restaurant reservation
            platform. Please read them carefully before using our services.
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
