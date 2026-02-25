import { useState } from 'react';
import { useAppStore } from '../store';
import { useTranslation } from 'react-i18next';

export function BettingPanel() {
    const { gameState, socket } = useAppStore();
    const { t } = useTranslation();
    const [betAmount, setBetAmount] = useState<number>(50);
    const [selectedFaction, setSelectedFaction] = useState<string>('МИРНІ');

    const handlePlaceBet = () => {
        if (!socket || !gameState.roomId) return;
        socket.emit('place_bet', { roomId: gameState.roomId, faction: selectedFaction, amount: betAmount });
    };

    const myId = useAppStore.getState().user?.id;
    const me = gameState.players?.find(p => p.userId === myId);

    // Only dead players or spectators can bet
    if (me?.isAlive && !me?.isSpectator) return null;

    // Has user already placed a bet? We don't have bet info per user sent to clients by default, 
    // but we added bets map to game state. Let's check.
    const myBet = gameState.bets?.find((b: any) => b.userId === myId);

    if (myBet) {
        return (
            <div className="bg-[#111] border border-mafia-red/30 p-4 rounded mb-4">
                <h3 className="text-mafia-red font-bold uppercase mb-2">Ваша ставка</h3>
                <p className="text-gray-300">Ви поставили <span className="text-yellow-500 font-bold">{myBet.amount}</span> монет на перемогу фракції <span className="text-white font-bold">{myBet.faction}</span>.</p>
            </div>
        );
    }

    // Only allow betting if game is strictly not ended
    if (gameState.phase === 'END_GAME' || gameState.phase === 'ROLE_DISTRIBUTION') return null;

    return (
        <div className="bg-[#111] border border-mafia-red/30 p-4 rounded mb-4 shadow-lg">
            <h3 className="text-mafia-red font-bold uppercase mb-3 text-lg">Ставки для глядачів</h3>
            <p className="text-sm text-gray-400 mb-4">Зробіть ставку на команду-переможця. У разі успіху ви отримаєте подвійну суму!</p>

            <div className="flex gap-4 mb-4">
                <select
                    value={selectedFaction}
                    onChange={e => setSelectedFaction(e.target.value)}
                    className="flex-1 bg-black border border-gray-700 rounded p-2 text-white"
                >
                    <option value="МИРНІ">Мирні Жителі (x2)</option>
                    <option value="МАФІЯ">Мафія (x2)</option>
                    <option value="МАНІЯК">Маніяк (x2)</option>
                </select>

                <input
                    type="number"
                    min="10"
                    max="1000"
                    step="10"
                    value={betAmount}
                    onChange={e => setBetAmount(parseInt(e.target.value) || 0)}
                    className="w-24 bg-black border border-gray-700 rounded p-2 text-white text-center"
                />
            </div>

            <button
                onClick={handlePlaceBet}
                className="w-full bg-mafia-red hover:bg-red-700 text-white font-bold py-2 rounded transition shadow-[0_0_10px_rgba(255,0,0,0.2)]"
            >
                ЗРОБИТИ СТАВКУ
            </button>
        </div>
    );
}
