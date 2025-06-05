interface Environment {
  API_URL: string;
}

const development: Environment = {
  API_URL: 'http://localhost:3000'
};

const production: Environment = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000' // Fallback to localhost if not set
};

// Vite automatically sets import.meta.env.MODE
const environment = import.meta.env.MODE === 'production' ? production : development;

export default environment; 