const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

var cors = require('cors');

const express = require('express');
const { response } = require('express');
const app = express();
app.use(cors());

const db = admin.firestore();

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
   db.collection('users')
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
   db.collection(`users/${req.body.uid}/jobs`)
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

// Get a specific job from logged in user below

app.get('/jobs/:jobId', validateIdToken, async (req, res) => {
   const jobRef = db.collection('users').doc(req.body.uid).collection('jobs').doc(req.params.jobId);
   const doc = await jobRef.get();
   
   if (!doc.exists) {
      console.log('No such document');
      return res.status(400).json({ error: 'No document found'});
   } else {
      console.log('Document data:', doc.data());
      return res.status(200).json({ data: doc.data() });
   }
});

// Add a job to the jobs collection for a specific user.  
// TODO: prevent user from creating a job with duplicate title

app.post('/jobs', validateIdToken, (req, res) => {
   if (req.body.title.trim() === '') {
      return res.status(400).json({ title: 'Must not be empty'});
   }

   if (!req.body.rate) {
      return res.status(400).json({ rate: 'Must not be empty'});
   }

   const jobMap = {
      uid: req.body.uid,
      title: req.body.title,
      rate: req.body.rate,
      createdAt: admin.firestore.Timestamp.fromDate(new Date())
   };

   db.collection('users').doc(req.body.uid).collection('jobs').add(jobMap)
      .then(doc => {
         res.json({ message: `job ${doc.id} created successfully`})
      })
      .catch(err => {
         res.status(500).json({ error: err});
         console.log(err);
      });
});

// Delete a job for a specific user ID and job title
// TODO: create delete button in front end and add the title with req params
// EX: <Link to={`/deletejob/${job.title}`}>{user.name}</Link>

app.delete('/deletejob/:jobId', validateIdToken, (req, res) => {
   const jobRef = db.collection('users').doc(req.body.uid).collection('jobs').doc(req.params.jobId);
   jobRef
      .get()
      .then((doc) => {
         if (!doc.exists) {
            return response.status(404).json({ error: 'Job not found' });
         }
         doc.ref.delete();
      })
      .then(() => {
         res.json({ message: 'Deletion successful'});
      })
      .catch((err) => {
         console.log(err);
         return res.status(500).json({ error: err });
      });
});

// Edit a job for a specific user.
// TODO: May need to adjust req params or update params

app.put('/editjob/:jobId', validateIdToken, (req, res) => {
   let jobRef = db.collection('users').doc(req.body.uid).collection('jobs').doc(req.params.jobId);
   jobRef.update({ title: req.body.newTitle, rate: req.body.newRate})
      .then(() => {
         res.json({ message: 'Updated successfully' });
      })
      .catch((err) => {
         console.error(err);
         return res.status(500).json({ error : err.code });
      });
});

exports.api = functions.https.onRequest(app);