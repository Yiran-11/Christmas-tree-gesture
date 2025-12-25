import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🟢 新增这一行！注意：'christmas-tree-gesture' 必须换成你 GitHub 仓库的真实名字
  // 如果你的仓库叫 luxury-tree2，这里就写 '/luxury-tree2/'
  base: '/Christmas-tree-gesture/', 
})