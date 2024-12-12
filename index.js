const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;


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
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unauthorized access" });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
                if (error) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })

        }

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




        //update user role to surveyor
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })


        //Update normal user role to pro-user from Admin dashboard
        app.patch('/users/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: "user" }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })


        //Delete a user by admin 
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })






        //==================Survey Releted api ==================
        // get all surveys from db
        app.get('/surveys', async (req, res) => {
            const result = await surveyCollection.find({ surveyStatus: 'publish' }).toArray();
            res.send(result);
        })


        // post a survey
        app.post('/surveys', async (req, res) => {
            const survey = req.body;
            const result = await surveyCollection.insertOne(survey);
            console.log(result);
            res.send(result);
        })


        app.get('/dashboard/admin/surveys', async (req, res) => {
            const result = await surveyCollection.find().toArray();
            res.send(result);
        })

        //get survey by id
        app.get('/surveys/surveyDetails/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await surveyCollection.findOne(query);
            res.send(result);
        })

        //get 6 most recently added surveys:
        app.get('/surveys/recent', async (req, res) => {
            const recentSurveys = await surveyCollection.find()
                .sort({ createdOn: -1 })
                .limit(6)
                .toArray();
            console.log(recentSurveys)
            res.send(recentSurveys);
        })

        //get survey by email
        app.get('/surveyor/surveys/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { createdBy: email };
            console.log(query)
            const result = await surveyCollection.find(query).toArray();
            console.log(result)
            res.send(result);
        })


        //display survey response on clicking surveyDetail from surveyor dashboard
        app.get('/dashboard/surveyor/surveys/:id', async (req, res) => {
            const id = req.params.id;
            const query = { surveyId: id };
            console.log(query);
            const result = await voteCollection.find(query).toArray();
            res.send(result);
        })


        // post a comment to a survey
        app.post('/comments', async (req, res) => {
            const commentData = req.body;
            const commentResult = await commentCollection.insertOne(commentData);
            console.log(commentResult);
            res.send(commentResult);
        })



        // get comments by email id
        app.get('/user/comments/:email', async (req, res) => {
            const userEmail = req.params.email;
            const query = { userEmail: userEmail };
            const result = await commentCollection.find(query).toArray();
            res.send(result);
        })


        // post a comment to a survey
        app.post('/reports', async (req, res) => {
            const reportData = req.body;
            const reportResult = await reportCollection.insertOne(reportData);
            console.log(reportResult);
            res.send(reportResult);
        })

        // post a comment to a survey
        app.get('/user/reports/:email', async (req, res) => {
            const userEmail = req.params.email;

            const query = { userEmail: userEmail };
            console.log(query);
            const result = await reportCollection.find(query).toArray();
            res.send(result);
        })


        //Update survey by surveyor
        app.patch('/surveyor/update/:id', async (req, res) => {
            const updatedSurvey = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    title: updatedSurvey.title,
                    description: updatedSurvey.description,
                    surveyStatus: updatedSurvey.surveyStatus,
                    category: updatedSurvey.category,
                    deadline: updatedSurvey.deadline,
                    surveyStatus: updatedSurvey.surveyStatus,
                    updatedOn: updatedSurvey.updatedOn
                }
            }
            const result = await surveyCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        //Delete a survey by surveyor 
        app.delete('/surveys/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await surveyCollection.deleteOne(query);
            res.send(result);
        })



        // check if user has voted to this survey or not
        app.get('/vote/check/:surveyId/:userEmail', async (req, res) => {
            const { surveyId, userEmail } = req.params;
            const vote = await voteCollection.findOne({ surveyId, userEmail });
            if (vote) {
                res.send({ hasVoted: true });
            } else {
                res.send({ hasVoted: false });
            }
        })



        // Perform a Vote api
        app.post('/vote', verifyToken, async (req, res) => {
            const { surveyId, userEmail, vote } = req.body;
            const existingVote = await voteCollection.findOne({ surveyId, userEmail });
            if (existingVote) {
                res.status(401).send({ message: "You have already voted on this survey!" });
            } else {
                const voteResult = await voteCollection.insertOne(req.body);

                //update voteCout
                const updateCount = vote === 'yes' ? { yesOption: 1 } : { noOption: 1 };
                const updateResult = await surveyCollection.updateOne(
                    { _id: new ObjectId(surveyId) },
                    { $inc: updateCount }
                )
                console.log(voteResult);
                res.send({ voteResult, updateResult });
            }
        })


        //Get participated survey by userEmail
        app.get('/user/surveys/:email', async (req, res) => {
            const email = req.params.email;
            const userVotes = await voteCollection.find({ userEmail: email }).toArray();
            const surveyIds = userVotes.map(vote => vote.surveyId);
            // console.log(userVotes)
            const surveys = await surveyCollection.find({
                _id: {
                    $in: surveyIds.map(id => new ObjectId(id))
                }
            }).toArray();
            const userSurveys = surveys.map(survey => {
                const vote = userVotes.find(vote => vote.surveyId === survey._id.toString());
                return { ...survey, vote: vote ? vote.vote : null };
            });
            // console.log("user surveys :", userSurveys)
            res.send(userSurveys);
        })


        //Payment integration======
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);  //as stripe calculate Poisha/Cent
            console.log("amount inside the intent", amount);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //get payment details for user
        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email };
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        //get all payment details for Admin
        app.get('/payments', verifyToken, async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        })

        // app.post('/payments', async (req, res) => {
        //     const payment = req.body;
        //     const paymentResult = await paymentCollection.insertOne(payment);
        //     console.log(paymentResult);
        //     res.send(paymentResult);
        // })
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const filter = { email: payment.email };
            const updateDoc = {
                $set: { role: "pro-user" }
            }
            const patchRes = await userCollection.updateOne(filter, updateDoc);

            const paymentResult = await paymentCollection.insertOne(payment);
            console.log(paymentResult);
            res.send({ paymentResult, patchRes });
        })

        //  app.patch('/users/:email', verifyToken, verifyAdmin, async (req, res) => {
        //     const email = req.params.email;
        //     const filter = { email: email };
        //     const updateDoc = {
        //         $set: { role: "pro-user" }
        //     }
        //     const result = await userCollection.updateOne(filter, updateDoc);
        //     res.send(result)
        // })


        //Update payment status from Admin dashboard
        app.patch('/payments/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { status: 'approved' }
            }
            const result = await paymentCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.post('/contactMessage', async (req, res) => {
            const messageInfo = req.body;
            const messageResult = await contactMessageCollection.insertOne(messageInfo);
            console.log(messageResult);
            res.send(messageResult);
        })
        app.get('/dashboard/contactMessage', async (req, res) => {
            const result = await contactMessageCollection.find().toArray();
            console.log(result);
            res.send(result);
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send("Survey Master is Running")
})
app.listen(port, (req, res) => {
    console.log(`Survey Master Server is running on Port: ${port}`)
})