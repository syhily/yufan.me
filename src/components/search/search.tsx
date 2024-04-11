'use client';
import * as Dialog from '@radix-ui/react-dialog';
import * as Form from '@radix-ui/react-form';
import React, { useState } from 'react';

import { options } from '#site/content';

const jump = (query: string) => {
  location.href = '/search?q=' + encodeURIComponent(query);
};

const search = (query: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
  jump(query);
};
const enter = (query: string) => (event: React.KeyboardEvent) => {
  if (event.key === 'Enter') {
    jump(query);
  }
};

export function Search() {
  const [query, setQuery] = useState('');
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild type={'reset'}>
        <div className="btn btn-dark btn-icon btn-circle site-search-toggler button-social">
          <span>
            <i className="iconfont icon-search"></i>
          </span>
        </div>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content className={'nice-popup nice-popup-center nice-popup-md nice-popup-open'}>
          <Dialog.Overlay className={'nice-popup-overlay'}></Dialog.Overlay>
          <div className="nice-popup-body">
            <Dialog.Close asChild>
              <div className="nice-popup-close">
                <span className="svg-white"></span> <span className="svg-dark"></span>
              </div>
            </Dialog.Close>
            <div className="nice-popup-content">
              <Form.Root className="text-center p-3 p-md-5">
                <Form.Field className="mb-3 mb-md-4" name="q">
                  <Form.Message className="FormMessage" match="valueMissing">
                    请输入查询的内容
                  </Form.Message>
                  <Form.Control asChild>
                    <input
                      className="form-control form-control-lg text-center"
                      type="text"
                      name="q"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索并回车"
                      onKeyDown={enter(query)}
                      required
                    />
                  </Form.Control>
                </Form.Field>
                <Form.Submit asChild>
                  <button
                    type="button"
                    className="btn btn-primary btn-block btn-lg"
                    onClick={search(query)}
                    onKeyDown={enter(query)}
                  >
                    搜索
                  </button>
                </Form.Submit>
              </Form.Root>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  return (
    <div id="search" className="widget widget_search" hidden={!options.settings.sidebar.search}>
      <div className="search-form">
        <label>
          <span className="screen-reader-text">搜索：</span>
          <input
            type="search"
            className="search-field"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索…"
            value={query}
            onKeyDown={enter(query)}
            name="q"
          />
        </label>
        <button type="button" className="search-submit" value="搜索" onClick={search(query)} onKeyDown={enter(query)} />
      </div>
    </div>
  );
}
