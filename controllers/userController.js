import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

// POST /api/user/register
export const register = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email and password are required' });
    }

    try {
        const exists = await User.findOne({ $or: [{ email }, { username }] });
        if (exists) {
            return res.status(409).json({ message: 'Username or email already taken' });
        }

        const user = await User.create({ username, email, password });
        const token = signToken(user._id);

        res.status(201).json({ token, user });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// POST /api/user/login
// Accepts either email or username in the identifier field
export const login = async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ message: 'Identifier and password are required' });
    }

    try {
        // Match on email or username depending on what was provided
        const isEmail = identifier.includes('@');
        const query = isEmail ? { email: identifier.toLowerCase() } : { username: identifier };

        const user = await User.findOne(query).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = signToken(user._id);

        res.json({ token, user });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// GET /api/user/me
export const getMe = (req, res) => {
    res.json({ user: req.user });
};

// PATCH /api/user/me/password
// Body: { currentPassword, newPassword }
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    if (currentPassword === newPassword) {
        return res.status(400).json({ message: 'New password must be different from current password' });
    }

    try {
        const user = await User.findById(req.user._id).select('+password');
        if (!user || !(await user.comparePassword(currentPassword))) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save(); // triggers the pre-save bcrypt hash

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/user/all (admin)
// Returns all registered users sorted by creation date.
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 }).lean();
        res.json({ users, total: users.length });
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// PATCH /api/user/:id/role (admin)
// Promote or demote a user between student and admin roles.
export const updateRole = async (req, res) => {
    const { role } = req.body;
    if (!['student', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'role must be student or admin' });
    }
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/user/:id (admin)
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};