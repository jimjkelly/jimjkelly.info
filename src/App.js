import React, { Component } from 'react';
import FontAwesome from 'react-fontawesome';
import './App.css';

class App extends Component {
  render() {
    return (
      <div className="App">
        <div className="App-sidebar">
          <div className="App-sidebar-content">
            <h1>jim<span className="middle-initial">j</span>kelly</h1>
            <p>
              Software Development for Operations and the Web.
            </p>
          </div>
        </div>
        <div className="App-content">
          <div className="App-content-social">
            <a title='email' href="&#109;&#97;&#105;&#x6c;&#x74;&#x6f;&#58;&#x70;&#116;&#x68;&#114;&#x65;&#97;&#x64;&#x31;&#57;&#56;&#x31;&#64;&#x67;&#109;&#x61;&#x69;&#108;&#x2e;&#99;&#111;&#x6d;">
              <FontAwesome className='social-link' name='envelope' size='2x' />
            </a>
            <a title='github' href="https://github.com/jimjkelly/">
              <FontAwesome className='social-link' name='github' size='2x' />
            </a>
            <a title='twitter' href="https://twitter.com/pthread">
              <FontAwesome className='social-link' name='twitter' size='2x' />
            </a>
            <a title='stack overflow' href="http://stackoverflow.com/story/jimjkelly">
              <FontAwesome className='social-link' name='stack-overflow' size='2x' />
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
