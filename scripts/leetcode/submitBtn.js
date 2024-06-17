const getSubmissionPageBtns = () => {
  return document.querySelector('.flex.flex-none.gap-2:not(.justify-center):not(.justify-between)');
};

const createToolTip = () => {
  const toolTip = document.createElement('div');
  toolTip.id = 'leethub-upload-tooltip';
  toolTip.textContent =
    'Manually upload this submission to GitHub (beta).\nThis will OVERWRITE your current submission.\nPlease be mindful of your GitHub rate-limits.';
  toolTip.className =
    'fixed bg-sd-popover text-sd-popover-foreground rounded-sd-md z-modal text-xs text-left font-normal whitespace-pre-line shadow p-3 border-sd-border border cursor-default translate-y-20 transition-opacity opacity-0 transition-delay-1000 duration-300 group-hover:opacity-100';
  return toolTip;
};

const createGitIcon = () => {
  const uploadIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  uploadIcon.setAttribute('id', 'leethub-upload-icon');
  uploadIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  uploadIcon.setAttribute('width', '16');
  uploadIcon.setAttribute('height', '17');
  uploadIcon.setAttribute('viewBox', '0 0 38.999866 56.642887');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'style',
    'fill:#fcfcfc;fill-opacity:1;stroke:#ffffff;stroke-width:3;stroke-dasharray:none;stroke-opacity:1',
  );
  path.setAttribute(
    'd',
    'm 19.775372,2.121319 -9.072314,9.072314 a 0.51539412,0.66999737 45 0 0 -0.109554,0.838192 0.49679682,0.64582142 45 0 0 0.810286,-0.125057 l 7.846033,-7.846033 v 30.608468 a 0.47397466,0.47397466 0 0 0 0.473873,0.473873 h 0.0093 a 0.51713218,0.51713218 0 0 0 0.516765,-0.517281 V 4.018877 l 7.559745,7.560262 a 0.62190211,0.49679682 45 0 0 0.793233,0.107487 0.64518265,0.51539412 45 0 0 -0.09198,-0.820621 l -8.033101,-8.033102 0.0047,-0.0047 z m 7.81141,17.001029 v 0.999939 l 5.229655,0.01189 a 3.6922154,3.6922154 0 0 1 3.683496,3.692281 v 26.633 a 3.6835681,3.6835681 0 0 1 -3.683496,3.683496 H 6.1834371 a 3.6835681,3.6835681 0 0 1 -3.683496,-3.683496 v -26.633 a 3.6835681,3.6835681 0 0 1 3.683496,-3.683496 H 11.538666 V 19.143023 H 6.3121111 a 4.8119141,4.8119141 0 0 0 -4.812109,4.812109 v 26.375651 a 4.8119141,4.8119141 0 0 0 4.812109,4.81211 H 32.687762 a 4.8119141,4.8119141 0 0 0 4.81211,-4.81211 V 23.955128 a 4.8220648,4.8220648 0 0 0 -4.81211,-4.822444 z',
  );

  uploadIcon.appendChild(path);
  return uploadIcon;
};

function addManualSubmitBtn(eventHandler) {
  const btns = getSubmissionPageBtns();
  if (btns.innerText.includes('Solution') && !btns.innerText.includes('LeetHub')) {
    btns.appendChild(
      (() => {
        const btn = document.createElement('button');
        btn.innerText = 'Sync w/ LeetHub';
        btn.setAttribute('style', 'background-color:darkorange');
        btn.setAttribute(
          'class',
          'group whitespace-nowrap focus:outline-none text-label-r bg-green-s dark:bg-dark-blue-s hover:bg-green-3 dark:hover:bg-dark-blue-3 flex items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium',
        );

        btn.prepend(createGitIcon());
        btn.appendChild(createToolTip());
        btn.addEventListener('click', eventHandler);
        return btn;
      })(),
    );
  }
}

function setupManualSubmitBtn(submitBtnHandler) {
  const submissionPageBtnsObserver = new MutationObserver((_, observer) => {
    const url = window.location.href;
    const btns = getSubmissionPageBtns();

    if (btns && btns.children.length < 3 && url.match(/\/submissions\//)) {
      observer.disconnect();
      addManualSubmitBtn(submitBtnHandler);
    }
  });

  // todo: change this to be firefox friendly https://developer.mozilla.org/en-US/docs/Web/API/Window/navigation
  window.navigation.addEventListener('navigate', () => {
    const isSubmissionUrl = window.location.href.match(/leetcode\.com\/(.*)\/submissions\/(\d+)/);
    if (isSubmissionUrl) {
      submissionPageBtnsObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  });
}

export default setupManualSubmitBtn;
