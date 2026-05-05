import axios from 'axios'

// Axios instance with basePath prepended so all API calls work correctly
// Next.js basePath is '/app', so '/api/users' must become '/app/api/users'
const api = axios.create({
  baseURL: '/app',
  headers: { 'Content-Type': 'application/json' },
})

export default api
