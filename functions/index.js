const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

var cors = require('cors');

const express = require('express');
const app = express();
app.use(cors());

const validateIdToken = (req, res, next) => {
   let idToken;

   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      idToken = req.headers.authorization.split('Bearer ')[1];
   } else {
      console.error('No token found');
      return res.status(403).json({error: 'Invalid access token'});
   }

   admin.auth().verifyIdToken(idToken)
      .then(decodedToken => {
         req.body.uid = decodedToken.uid;
         console.log('ID Token decoded', decodedToken);
         return next();
      }).catch(function(error) {
         console.log(error);
         res.status(403).send('Unauthorized');
      })
};

// Uses firebase auth that watches for user creation which triggers a new user to be added to the db

exports.newUser = functions.auth.user().onCreate((user) => {
   const userMap = {
      name: user.displayName,
      uid: user.uid,
      email: user.email,
      createdAt: admin.firestore.Timestamp.fromDate(new Date())
   };
   return admin.firestore().collection('users').doc(user.uid).set(userMap);
 });

// Get all users 

app.get('/users', validateIdToken, (req, res) => {
   console.log('ran users');
   admin
   .firestore()
   .collection('users')
   .orderBy('createdAt', 'desc')
   .get()
   .then((querySnapshot) => {
      let users = [];
      querySnapshot.forEach((doc) => {
         users.push({
            userId: doc.id,
            jobs: doc.data().jobs,
            uid: doc.data().uid,
            createdAt: doc.data().createdAt
         });
      });
      return res.json(users);
   })
   .catch((err) => console.error(err));
})

// Get all jobs from a specific user

app.get('/jobs', validateIdToken, (req, res) => {
   console.log('ran users');
   admin
   .firestore()
   .collection(`users/${req.body.uid}/jobs`)
   .orderBy('createdAt', 'desc')
   .get()
   .then((querySnapshot) => {
      let jobs = [];
      querySnapshot.forEach((doc) => {
         jobs.push({
            uid: doc.data().uid,
            title: doc.data().title,
            rate: doc.data().rate,
            createdAt: doc.data().createdAt
         });
      });
      return res.json(jobs);
   })
   .catch((err) => console.error(err));
})

// Add a job to the jobs collection for a specific user

app.post('/jobs', validateIdToken, (req, res) => {
   const newJob = {
      uid: req.body.uid,
      title: req.body.title,
      rate: req.body.rate,
      createdAt: admin.firestore.Timestamp.fromDate(new Date())
   };

   admin
      .firestore()
      .collection(`users/${req.body.uid}/jobs`)
      .add(newJob)
      .then(doc => {
         res.json({ message: `job ${doc.id} created successfully`})
      })
      .catch(err => {
         res.status(500).json({ error: err});
         console.log(err);
      });
});

exports.api = functions.https.onRequest(app);