import React from 'react';
import {createRoot} from 'react-dom/client';
import {SheetApp} from './sheet-app';
import './style.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><SheetApp/></React.StrictMode>);
