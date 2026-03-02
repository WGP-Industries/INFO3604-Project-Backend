import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorised - no token' });
    }

    try {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) return res.status(401).json({ message: 'User not found' });
        next();
    } catch {
        res.status(401).json({ message: 'Token invalid or expired' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};


export default { protect, adminOnly };