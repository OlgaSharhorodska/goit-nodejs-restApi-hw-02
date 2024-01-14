import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from "../models/User.js";
import { HttpError } from '../helpers/index.js';
import ctrlWrapper from '../helpers/ctrlWrapper.js';
import 'dotenv/config';
import gravatar from 'gravatar';
import path from 'path';
import fs from 'fs/promises';
import Jimp from 'jimp';

const { JWT_SECRET } = process.env;
const avatarsDir = path.resolve('public', 'avatars');

const register = async (req, res) => {
    const { email,password } = req.body;
    const user = await User.findOne({email})
    if (user) {
        throw HttpError(409, 'Email in use');
    }

  const hashPassword = await bcrypt.hash(password, 10);
  const avatarURL = gravatar.url(email);

    const newUser = await User.create({ ...req.body, password: hashPassword, avatarURL });
    
   const { subscription } = newUser;
   res.status(201).json({
     user: {
       email: newUser.email,
       subscription,
     },
   });
}

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, 'Email or password is wrong');
  }
  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, 'Email or password is wrong');
  }

  const { _id: id, subscription } = user;
  const payload = {
    id,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '23h' });
  await User.findByIdAndUpdate(id, { token });
  res.json({
    token,
    user: {
      email,
      subscription,
    },
  });
}

const getCurrent = async (req, res) => {
  const { email, subscription } = req.user;
  if (!email || !subscription) {
    throw HttpError(401, 'Not authorized');
  }
  res.json({
    email,
    subscription,
  });
}

const logout = async (req, res) =>
{
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: '' });
  res.status(204).json();
  
}

const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      throw HttpError(401, 'Not authorized');
    }

    const { _id } = req.user;
    const { path: tmpUpload, originalname } = req.file;
    const filename = `${_id}_${originalname}`;
    const resultUpload = path.join(avatarsDir, filename);

    await Jimp.read(tmpUpload)
      .then((image) => image.resize(250, 250))
      .then((image) => image.write(resultUpload));

    await fs.unlink(tmpUpload);

    const avatarURL = path.join('avatars', filename);
    await User.findByIdAndUpdate(_id, { avatarURL });

    res.json({
      avatarURL,
    });
  } catch (error) {
    // console.error('Error updating avatar:', error.message);
    res.status(400).json({ error: error.message });
  }
};

export default {
  register: ctrlWrapper(register),
  login: ctrlWrapper(login),
  getCurrent: ctrlWrapper(getCurrent),
  logout: ctrlWrapper(logout),
  updateAvatar:ctrlWrapper(updateAvatar),
};