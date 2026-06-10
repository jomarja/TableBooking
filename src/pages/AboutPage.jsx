import { motion } from 'framer-motion';
import { FiTarget, FiHeart, FiZap, FiUsers, FiShield, FiGlobe } from 'react-icons/fi';

export default function AboutPage() {
  const values = [
    { icon: FiTarget, title: 'Our Mission', description: 'To make restaurant reservations effortless and enjoyable, connecting diners with their perfect dining experience in just a few taps.' },
    { icon: FiHeart, title: 'User First', description: 'Every design decision is made with the user in mind. Intuitive interfaces, clear feedback, and zero friction from search to confirmation.' },
    { icon: FiZap, title: 'Innovation', description: 'Interactive floor plans, real-time availability, and smart recommendations set us apart from traditional booking platforms.' },
  ];

  const stats = [
    { value: '500+', label: 'Partner Restaurants' },
    { value: '50K+', label: 'Happy Diners' },
    { value: '4.9', label: 'Average Rating' },
    { value: '30s', label: 'Avg. Booking Time' },
  ];

  const team = [
    { name: 'Giorgi Jomarjidze', role: 'Founder & Lead Developer', icon: FiUsers },
    { name: 'TableBooker Team', role: 'UX Design & Research', icon: FiShield },
    { name: 'Open Source', role: 'Community Contributors', icon: FiGlobe },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 py-20 px-4">
        <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)', backgroundSize: '50px 50px' }} />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            About TableBooker
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-lg text-white/80 max-w-2xl mx-auto"
          >
            A smart restaurant reservation platform that combines beautiful design
            with powerful functionality to deliver the best booking experience possible.
          </motion.p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 -mt-24 relative z-10 mb-16"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 text-center">
              <p className="text-3xl font-bold text-emerald-600">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Values */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">What We Stand For</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {values.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Discover', desc: 'Search and browse restaurants by cuisine, location, or rating.' },
              { step: '2', title: 'Choose', desc: 'Pick your date, party size, and select your perfect table from the floor plan.' },
              { step: '3', title: 'Reserve', desc: 'Select your time slot and fill in your details for confirmation.' },
              { step: '4', title: 'Enjoy', desc: 'Receive instant confirmation and head to your table stress-free.' },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Our Team</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <member.icon className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{member.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-10 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-3">Ready to Find Your Table?</h2>
          <p className="text-white/80 max-w-xl mx-auto mb-6">
            Join thousands of diners who use TableBooker to discover and reserve at the best restaurants.
          </p>
          <a
            href="/"
            className="inline-flex items-center px-8 py-3 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-gray-50 transition-colors min-h-[48px]"
          >
            Start Booking
          </a>
        </motion.div>
      </div>
    </div>
  );
}
