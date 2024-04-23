'use client';
import * as Dialog from '@radix-ui/react-dialog';
import React, { ReactElement } from 'react';
import QRCode from 'react-qr-code';

export type QRLink = {
  url: string;
  name: string;
  title: string;
  icon: string;
  className?: string;
};

export function QRDialog({ url, name, title, icon, className }: QRLink) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild type={'reset'}>
        <div className={className ?? `btn btn-dark btn-icon btn-circle single-popup button-social`}>
          <span>
            <i className={`iconfont ${icon}`}></i>
          </span>
        </div>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content className={'nice-popup nice-popup-center nice-popup-sm nice-popup-open'}>
          <Dialog.Overlay className={'nice-popup-overlay'}></Dialog.Overlay>
          <div className="nice-popup-body">
            <Dialog.Close asChild>
              <div className="nice-popup-close">
                <span className="svg-white"></span> <span className="svg-dark"></span>
              </div>
            </Dialog.Close>
            <div className="nice-popup-content">
              <div className="text-center">
                <h6>{title}</h6>
                <p className="mt-1 mb-2">{name}</p>
                <SVG url={url} title={title} />
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SVG({ url, title }: { url: string; title: string }): ReactElement {
  return (
    <div title={title}>
      <QRCode size={128} value={url} />
    </div>
  );
}
