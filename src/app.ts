import express from 'express'
import cors from 'cors'
import lessonAssets from './routes/lessonAssets'

const app = express()
app.use(cors())           // only needed if you’re NOT using the Vite proxy
app.use(express.json())
app.use(lessonAssets)

app.listen(3000, () => console.log('API on http://localhost:3000'))
