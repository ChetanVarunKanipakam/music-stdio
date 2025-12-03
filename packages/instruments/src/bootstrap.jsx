import React from 'react';
import ReactDOM from 'react-dom/client';
import Library from './Library.jsx';

const root = ReactDOM.createRoot(document.getElementById('root'));
// We render the Library directly just for testing in standalone mode
root.render(<Library />);