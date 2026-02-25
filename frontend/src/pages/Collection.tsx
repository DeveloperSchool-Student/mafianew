import { useNavigate } from 'react-router-dom';

export function Collection() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-mafia-dark text-white p-8 flex flex-col items-center justify-center">
            <button onClick={() => navigate(-1)} className="absolute top-8 left-8 text-mafia-red hover:underline mb-8 self-start">
                &larr; Назад
            </button>
            <h1 className="text-4xl font-bold mb-4 text-mafia-red tracking-widest uppercase">Колекція</h1>
            <p className="text-gray-400 text-xl">Coming soon</p>
        </div>
    );
}
