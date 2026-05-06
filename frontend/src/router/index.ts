import { createRouter, createWebHistory } from 'vue-router'
import SongSelect from '../views/SongSelect.vue'
import Play from '../views/Play.vue'
import Result from '../views/Result.vue'
import Editor from '../views/Editor.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: SongSelect },
        { path: '/play', component: Play },
        { path: '/result', component: Result },
        { path: '/editor', component: Editor },
    ],
})

export default router
