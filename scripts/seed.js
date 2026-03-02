// scripts/seed.js
// Run with: node scripts/seed.js
// Seeds the database with courses, projects, and an initial admin user.

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from '../models/Course.js';
import User from '../models/User.js';

dotenv.config();

const COURSES = [
    {
        courseCode: 'COMP3609',
        name: 'COMP 3609 - Game Programming',
        description:
            'An introduction to game programming using Java, covering the game loop, 2D graphics, sprites, animation, sound, collision detection, physics, and design patterns. Students build a fully playable 2D platform game as their final project.',
        uri: 'https://example.edu/comp3609',
        project: {
            name: '2D Platform Game',
            description:
                'Students design and develop a fully playable 2D platform game in Java using the Java 2D Graphics API. The game must incorporate a game loop, animated sprites, collision detection, user input, sound, parallax backgrounds, tile-based maps, and at least one design pattern. The final deliverable is a complete, runnable game.',
        },
    },
    {
        courseCode: 'COMP3610',
        name: 'COMP 3610 - Big Data Analytics',
        description:
            'A project-based course where student groups tackle a real-world data science problem. Students collect and process datasets, apply analysis algorithms, build an application to communicate their findings, and present results in a final report and live demo.',
        uri: 'https://example.edu/comp3610',
        project: {
            name: 'Data Analytics Application',
            description:
                'Groups of three identify a data science problem, source a real-world dataset, and apply appropriate analysis methods and algorithms. The project progresses through a proposal, two check-ins, a progress report, and culminates in a working application or dashboard, a 15-20 minute live presentation, and a final IEEE-formatted report with code. Overall worth 50% of the course grade.',
        },
    },
];

const ADMIN_USER = {
    username: 'admin',
    email: 'admin@example.edu',
    password: 'Admin@1234',
    role: 'admin',
};

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Upsert courses by courseCode
        for (const course of COURSES) {
            const result = await Course.findOneAndUpdate(
                { courseCode: course.courseCode },
                course,
                { upsert: true, new: true }
            );
            console.log(`Course seeded: ${result.courseCode} - ${result.name}`);
        }

        // Seed admin user
        const existingAdmin = await User.findOne({ email: ADMIN_USER.email });
        if (existingAdmin) {
            if (existingAdmin.role !== 'admin') {
                existingAdmin.role = 'admin';
                await existingAdmin.save();
                console.log(`Admin role updated for: ${existingAdmin.email}`);
            } else {
                console.log(`Admin already exists: ${existingAdmin.email}`);
            }
        } else {
            const admin = await User.create(ADMIN_USER);
            console.log(`Admin created: ${admin.email}  (password: ${ADMIN_USER.password})`);
        }

        console.log('\nSeed complete.');
    } catch (err) {
        console.error('Seed error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seed();