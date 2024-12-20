const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const bcrypt = require('bcrypt');


// app.use(cors());
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:5000",
            "https://vericash-abrar.firebaseapp.com",
            "https://vericash-abrar.web.app",
            "https://vericash.netlify.app",
        ]
    })
);
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1qcsvas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const lessonCollection = client.db('japanLearn').collection('lessons');
        const userCollection = client.db('japanLearn').collection('users');



        //JWT releted api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
                expiresIn: "1h"
            });
            res.send({ token });
        })

        //Middlewares
        const verifyToken = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: "Unauthorized access" });
            }

            const token = authHeader.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: "Unauthorized access" });
                }
                req.decoded = decoded; // Attach decoded token to the request
                next();
            });
        };


        // Get the current user's information
        app.get('/me', verifyToken, async (req, res) => {
            try {
                const email = req?.decoded?.email; // Extract email from the decoded token
                const user = await userCollection?.findOne({ email });
                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }
                res.send({
                    user: {
                        name: user?.name,
                        email: user?.email,
                        photo: user?.photo,
                        role: user?.role,
                    },
                });
            } catch (error) {
                console.error("Error fetching user data:", error);
                res.status(500).send({ message: "Failed to fetch user data" });
            }
        });



        //use verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "admin";
            if (!isAdmin) {
                return res.status(401).send({ message: "forbidden access" });
            }
            next();
        }


        app.post('/register', async (req, res) => {
            const { name, email, password, photo } = req.body;

            try {
                // Check if the user already exists
                const existingUser = await userCollection.findOne({ email });
                if (existingUser) {
                    return res.status(400).send({ message: "User already exists" });
                }

                // Hash the password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Create the new user
                const newUser = {
                    name,
                    email,
                    password: hashedPassword,
                    photo,
                    role: "user",
                };

                const result = await userCollection.insertOne(newUser);

                const token = jwt.sign({ email: newUser.email }, process.env.ACCESS_TOKEN, {
                    expiresIn: "1h",
                });

                res.status(201).send({
                    message: "User registered successfully",
                    token,
                    user: {
                        name: newUser.name,
                        email: newUser.email,
                        photo: newUser.photo,
                        role: newUser.role,
                    },
                });
            } catch (error) {
                console.error("Error registering user:", error);
                res.status(500).send({ message: "Registration failed", error });
            }
        });



        // Login User
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;

            try {
                // Check if user exists
                const user = await userCollection.findOne({ email });
                if (!user) {
                    return res.status(400).send({ message: "Invalid email or password" });
                }

                // Compare password
                const isPasswordValid = await bcrypt.compare(password, user.password);
                if (!isPasswordValid) {
                    return res.status(400).send({ message: "Invalid email or password" });
                }

                // Generate JWT token
                const token = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN, {
                    expiresIn: "1h",
                });

                res.send({
                    message: "Login successful",
                    token,
                    user: { name: user.name, email: user.email, photo: user.photo },
                });
            } catch (error) {
                console.error("Login error:", error);
                res.status(500).send({ message: "Login failed", error });
            }
        });


        //Lessons api
        //get lessons data
        app.get('/lessons', verifyToken, async (req, res) => {
            const result = await lessonCollection.find().toArray();
            res.send(result);
        })

        // get lesson details
        app.get('/lesson/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await lessonCollection.findOne(query);
            res.send(result);
        })


        app.post('/lessons', verifyToken, verifyAdmin, async (req, res) => {
            const { lessonName, lessonNumber } = req.body;

            if (!lessonName || !lessonNumber) {
                return res.status(400).send({ message: "Lesson Name and Lesson Number are required." });
            }
            try {
                const existingLesson = await lessonCollection.findOne({ lessonNumber });
                if (existingLesson) {
                    return res.status(400).send({ message: "Lesson with this number already exists." });
                }

                const newLesson = {
                    lessonName,
                    lessonNumber,
                    createdAt: new Date(),
                };

                const result = await lessonCollection.insertOne(newLesson);
                res.status(201).send({
                    message: "Lesson added successfully",
                    lesson: { ...newLesson, _id: result.insertedId },
                });
            } catch (error) {
                console.error("Error adding lesson:", error);
                res.status(500).send({ message: "Failed to add lesson", error });
            }
        });


        // Get lessons with vocabulary count
        app.get('/lessons', verifyToken, async (req, res) => {
            try {
                const lessons = await lessonCollection.aggregate([
                    {
                        $lookup: {
                            from: 'vocabularies',  // Assuming you have a vocabularies collection
                            localField: '_id',  // Reference to lesson _id
                            foreignField: 'lessonId',  // Reference to lesson in vocabularies collection
                            as: 'vocabularies'
                        }
                    },
                    {
                        $project: {
                            lessonName: 1,
                            lessonNumber: 1,
                            vocabularyCount: { $size: "$vocabularies" },  // Count number of vocabulary items
                        }
                    }
                ]).toArray();
                console.log(result); // Check what is being returned from the database

                res.send(lessons);
            } catch (error) {
                console.error("Error fetching lessons:", error);
                res.status(500).send({ message: "Failed to fetch lessons" });
            }
        });


        //============user releted api===============
        //get users data
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        //Post user to mongodb
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User already exist!", insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })


        //getting user status is admin or not
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin });
        })














    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send("Japan Learn is Running")
})
app.listen(port, (req, res) => {
    console.log(`Japan Learn Server is running on Port: ${port}`)
})