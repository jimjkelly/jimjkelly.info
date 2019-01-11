import React, { Component } from 'react'
import { Link } from 'gatsby'
import styles from './index.module.css'

class App extends Component {
  render() {
    return (
      <div className={styles.App}>
        <div className={styles.AppSidebar}>
          <div className={styles.AppSidebarContent}>
            <h1>jim<span className={styles.middleInitial}>j</span>kelly</h1>
            <p>
              Software Development for Operations and the Web.
            </p>
          </div>
        </div>
        <div className={styles.AppContent}>
          <div className={styles.AppContentSocial}>
            <Link title="blog" to="/blog/">
              <i className={styles.bookIcon} />
            </Link>
            <a title="email" href="&#109;&#97;&#105;&#x6c;&#x74;&#x6f;&#58;&#x70;&#116;&#x68;&#114;&#x65;&#97;&#x64;&#x31;&#57;&#56;&#x31;&#64;&#x67;&#109;&#x61;&#x69;&#108;&#x2e;&#99;&#111;&#x6d;">
              <i className={styles.envelopeIcon} />
            </a>
            <a title="github" href="https://github.com/jimjkelly/">
              <i className={styles.githubIcon} />
            </a>
            <a title="twitter" href="https://twitter.com/pthread">
            <i className={styles.twitterIcon} />
            </a>
            <a title="stack overflow" href="http://stackoverflow.com/story/jimjkelly">
              <i className={styles.stackOverflowIcon} />
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
