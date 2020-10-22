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
         let uid = decodedToken.uid;
         console.log('ID Token decoded', decodedToken);
         return next();
      }).catch(function(error) {
         console.log(error);
         res.status(403).send('Unauthorized');
      })
};

app.get('/users', (req, res) => {
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

app.post('/users', (req, res) => {
   const newUser = {
      jobs: req.body.jobs,
      uid: req.body.uid,
      createdAt: new Date().toISOString()
   };

   admin
      .firestore()
      .collection('users')
      .add(newUser)
      .then(doc => {
         res.json({ message: `document ${doc.id} created successfully`})
      })
      .catch(err => {
         res.status(500).json({ error: err});
         console.log(err);
      });
});

exports.api = functions.https.onRequest(app);