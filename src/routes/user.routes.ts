import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';
import { getUsers, getUserById, updateUser, deleteUser, createUser } from '../controllers/user.controller';

const router = Router();

// Todas las rutas de usuarios requieren estar autenticado y ser administrador
router.use(requireAuth);
router.use(requireAdmin);

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
