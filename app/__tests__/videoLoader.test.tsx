// @jest-environment jsdom
// If you see type errors, ensure you have @types/jest and @testing-library/react installed
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import Home from '../page';

// Mock fetch for /api/video-to-base64
beforeEach(() => {
  global.fetch = jest.fn((url, opts) => {
    if (typeof opts === 'object' && opts.body) {
      const body = JSON.parse(opts.body);
      if (body.url?.includes('public-youtube')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ base64: 'data:video/mp4;base64,VALIDYOUTUBE' }) });
      }
      if (body.url?.includes('unlisted-youtube')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ base64: 'data:video/mp4;base64,UNLISTEDYOUTUBE' }) });
      }
      if (body.url?.includes('public-gdrive')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ base64: 'data:video/mp4;base64,VALIDGDRIVE' }) });
      }
      if (body.url?.includes('invalid')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Invalid video' }) });
      }
      if (!body.url) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Empty URL' }) });
      }
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Unknown' }) });
  }) as any;
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Video Loader Integration', () => {
  it('loads and enables AI for valid local file', async () => {
    render(<Home />);
    // Simulate file upload
    const file = new File(['dummy'], 'test.mp4', { type: 'video/mp4' });
    const fileInput = screen.getByLabelText(/upload video/i);
    fireEvent.change(fileInput, { target: { files: [file] } });
    // Simulate video loaded
    await waitFor(() => expect(screen.getByText(/process with ai/i)).toBeInTheDocument());
  });

  it('loads and enables AI for public YouTube', async () => {
    render(<Home />);
    const urlInput = screen.getByPlaceholderText(/paste youtube/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=public-youtube' } });
    fireEvent.click(screen.getByText(/load video from url/i));
    await waitFor(() => expect(screen.getByText(/process with ai/i)).toBeInTheDocument());
  });

  it('loads and enables AI for unlisted YouTube', async () => {
    render(<Home />);
    const urlInput = screen.getByPlaceholderText(/paste youtube/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=unlisted-youtube' } });
    fireEvent.click(screen.getByText(/load video from url/i));
    await waitFor(() => expect(screen.getByText(/process with ai/i)).toBeInTheDocument());
  });

  it('loads and enables AI for public Google Drive', async () => {
    render(<Home />);
    const urlInput = screen.getByPlaceholderText(/paste youtube/i);
    fireEvent.change(urlInput, { target: { value: 'https://drive.google.com/file/d/public-gdrive/view' } });
    fireEvent.click(screen.getByText(/load video from url/i));
    await waitFor(() => expect(screen.getByText(/process with ai/i)).toBeInTheDocument());
  });

  it('does not enable AI for invalid/corrupt/unsupported video', async () => {
    render(<Home />);
    const urlInput = screen.getByPlaceholderText(/paste youtube/i);
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=invalid' } });
    fireEvent.click(screen.getByText(/load video from url/i));
    await waitFor(() => expect(screen.queryByText(/process with ai/i)).not.toBeInTheDocument());
  });

  it('does not enable AI for empty/broken URL', async () => {
    render(<Home />);
    const urlInput = screen.getByPlaceholderText(/paste youtube/i);
    fireEvent.change(urlInput, { target: { value: '' } });
    fireEvent.click(screen.getByText(/load video from url/i));
    await waitFor(() => expect(screen.queryByText(/process with ai/i)).not.toBeInTheDocument());
  });
}); 