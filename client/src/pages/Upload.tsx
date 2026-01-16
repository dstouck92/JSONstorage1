import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [username, setUsername] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ success: boolean; recordsImported: number } | null>(null);
  const navigate = useNavigate();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.json'));
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (username.trim()) {
      formData.append('username', username.trim());
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setTimeout(() => navigate('/profile'), 2000);
      }
    } catch (err) {
      console.error(err);
    }
    setUploading(false);
  };

  if (result?.success) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="bg-white/70 backdrop-blur rounded-2xl p-8 shadow-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Upload Complete!</h1>
          <p className="text-gray-600 mb-4">
            Successfully imported {result.recordsImported.toLocaleString()} streaming records.
          </p>
          <p className="text-gray-500">Redirecting to your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white/70 backdrop-blur rounded-2xl p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Join Herd</h1>
        <p className="text-gray-600 text-center mb-6">
          Upload your Spotify Extended Streaming History to get started
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your display name"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition ${
            dragOver ? 'border-green-500 bg-green-50' : 'border-gray-300'
          }`}
        >
          <div className="text-4xl mb-4">📁</div>
          <p className="text-gray-600 mb-2">Drag & drop your JSON files here</p>
          <p className="text-gray-400 text-sm mb-4">or</p>
          <label className="inline-block bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg cursor-pointer">
            Browse Files
            <input
              type="file"
              multiple
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>

        {files.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">{files.length} file(s) selected:</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                  <span className="truncate">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700 ml-2">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3 rounded-xl font-medium"
        >
          {uploading ? 'Uploading...' : 'Upload & Join Herd'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          You can request your Extended Streaming History from Spotify's Privacy Settings
        </p>
      </div>
    </div>
  );
}
