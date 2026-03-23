import { Link } from 'react-router-dom'

function About() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          About Skill Swap
        </h1>
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
            Skill Swap is a platform where people can exchange knowledge and skills with each other.
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
            Whether you want to learn a new language, master a musical instrument, or develop coding skills,
            our community is here to help you grow.
          </p>
        </div>
        <Link
          to="/"
          className="inline-block mt-8 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}

export default About
